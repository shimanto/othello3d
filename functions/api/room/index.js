const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function onRequestPost(context) {
  const { env } = context;
  const KV = env.GAME_KV;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { playerId, boardSize, layerCount } = body;
  if (!playerId || !boardSize || !layerCount) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const roomId = generateRoomId();
  const room = {
    id: roomId,
    black: { id: playerId },
    white: null,
    boardSize,
    layerCount,
    board: null,
    turn: 1,
    gameOver: false,
    lastMove: null,
    created: Date.now(),
  };

  await KV.put(`room:${roomId}`, JSON.stringify(room));

  return jsonResponse({ roomId, color: 'black' });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
