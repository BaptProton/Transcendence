// Construit les colonnes utilisateur avec un alias de table (ex: 'u' -> 'u.id, u.username, ...')
export function buildUserColumns(alias) {
  const columns = ['id', 'username', 'email', 'display_name', 'avatar', 'wins', 'losses', 'is_online', 'last_seen', 'created_at', 'updated_at'];
  return columns.map(col => `${alias}.${col}`).join(', ');
}

// Serialise un utilisateur pour les reponses API
// Supprime les champs sensibles et convertit is_online en online (bool)
export function serializeUser(row) {
  if (!row) return null;
  const { password_hash, two_factor_secret, is_online, ...rest } = row;
  return { ...rest, online: Boolean(is_online) };
}

// Serialise un utilisateur pour les reponses d'authentification (pas de password_hash)
export function serializeAuthUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    avatar: user.avatar,
    wins: user.wins,
    losses: user.losses,
    is_online: user.is_online,
    last_seen: user.last_seen,
    created_at: user.created_at
  };
}
