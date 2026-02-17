import { Web3 } from 'web3';

const WEB3_PROVIDER_URI = process.env.WEB3_PROVIDER_URI
const BLOCKCHAIN_PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS

let web3;
let contract;
let account;

const CONTRACT_ABI = [
  {
    "inputs": [
      {"internalType": "uint256", "name": "_tournamentId", "type": "uint256"},
      {"internalType": "string", "name": "_formattedResult", "type": "string"}
    ],
    "name": "storeTournament",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_tournamentId", "type": "uint256"}],
    "name": "getTournamentResult",
    "outputs": [
      {"internalType": "string", "name": "formattedResult", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

function initializeWeb3() {
  if (!BLOCKCHAIN_PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.warn('[WARN] Blockchain not configured (missing BLOCKCHAIN_PRIVATE_KEY or CONTRACT_ADDRESS)');
    return false;
  }

  try {
    web3 = new Web3(WEB3_PROVIDER_URI);
    const privateKey = BLOCKCHAIN_PRIVATE_KEY;
    account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);
    contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
    return true;
  } catch (error) {
    console.error('[ERROR] Failed to initialize Web3:', error);
    return false;
  }
}

export default async function blockchainRoutes(app) {
  const db = app.db; // app = instance Fastify
  let web3Initialized = false;

  try {
    web3Initialized = initializeWeb3();
  } catch (error) {
    app.log.warn('[WARN] Blockchain service initialization failed, routes will be disabled');
    app.log.warn('[WARN] Error:', error.message);
  }

  app.post('/api/blockchain/tournament/record/', {
    preValidation: [app.authenticate],
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 hour'
      }
    },
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['tournament_id', 'winner_username', 'winner_score', 'loser_username', 'loser_score'],
        properties: {
          tournament_id: { type: 'integer', minimum: 1 },
          winner_username: { type: 'string', minLength: 1, maxLength: 100 },
          winner_score: { type: 'integer', minimum: 0 },
          loser_username: { type: 'string', minLength: 1, maxLength: 100 },
          loser_score: { type: 'integer', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    if (!web3Initialized) {
      return reply.code(503).send({ error: 'Blockchain service not configured' });
    }

    const { tournament_id, winner_username, winner_score, loser_username, loser_score } = request.body;

    const formattedResult = `Tournament #${tournament_id} / ${winner_username} vs ${loser_username} / ${winner_score} - ${loser_score} -> winner = ${winner_username}`;

    try {
      const tx = await contract.methods.storeTournament(
        tournament_id,
        formattedResult
      ).send({
        from: account.address,
        gas: 300000
      });

      // Convertir BigInt en Number pour la Database
      const blockNumber = typeof tx.blockNumber === 'bigint' 
        ? Number(tx.blockNumber) 
        : tx.blockNumber;

      const stmt = db.prepare(`
        INSERT INTO blockchain_scores (tournament_id, winner_username, formatted_result, tx_hash, block_number)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(tournament_id, winner_username, formattedResult, tx.transactionHash, blockNumber);

      reply.send({
        success: true,
        tx_hash: tx.transactionHash,
        block_number: blockNumber,
      });
    } catch (error) {
      request.log.error('[ERROR]', error);
      reply.code(500).send({ error: 'Failed to record on blockchain' });
    }
  });

  app.get('/api/blockchain/history/', {
    preValidation: [app.authenticate],
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    if (!web3Initialized) {
      return reply.code(503).send({ error: 'Blockchain service not configured' });
    }

    const lastRecord = db.prepare(`
      SELECT tournament_id, winner_username, tx_hash, block_number
      FROM blockchain_scores
      ORDER BY created_at DESC
      LIMIT 1
    `).get();

    if (!lastRecord) {
      return reply.send([]);
    }

    try {
      const formattedResult = await contract.methods.getTournamentResult(lastRecord.tournament_id).call();

      reply.send([{
        winner_username: lastRecord.winner_username,
        tx_hash: lastRecord.tx_hash,
        block_number: lastRecord.block_number,
        formatted_result: formattedResult
      }]);
    } catch (error) {
      request.log.error('[ERROR]', error);
      reply.code(500).send({ error: 'Failed to retrieve from blockchain' });
    }
  });
}
