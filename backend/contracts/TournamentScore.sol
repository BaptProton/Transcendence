// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TournamentScore
{

    struct Tournament
    {
        uint256 tournamentId;
        address recordedBy;
        string formattedResult;
        bool exists;
    }

    mapping(uint256 => Tournament) public tournaments;
    
    event TournamentStored
    (
        uint256 indexed tournamentId,
        address recordedBy,
        string formattedResult,
        uint256 timestamp
    );

    function storeTournament
    (
        uint256 _tournamentId,
        string memory _formattedResult
    )
    public
    {
        require(!tournaments[_tournamentId].exists, "Tournament already stored");

        tournaments[_tournamentId] = Tournament({
            tournamentId: _tournamentId,
            recordedBy: msg.sender,
            formattedResult: _formattedResult,
            exists: true
        });

        emit TournamentStored
        (
            _tournamentId,
            msg.sender,
            _formattedResult,
            block.timestamp
        );
    }

    function getTournamentResult
    (
        uint256 _tournamentId
    )
        public
        view
        returns
        (
            string memory formattedResult
        )
    {
        require(tournaments[_tournamentId].exists, "Tournament not found");

        Tournament memory t = tournaments[_tournamentId];
        return (t.formattedResult);
    }
}
