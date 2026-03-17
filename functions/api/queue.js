const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

  const { playerId, boardSize, layerCount, gameType } = body;
  if (!playerId || !boardSize || !layerCount) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const gt = gameType || '3d';
  const queueKey = `queue:${gt}:${boardSize}:${layerCount}`;
  const existing = await KV.get(queueKey, 'json');

  if (existing && existing.playerId !== playerId) {
    // Match found — create room
    const roomId = generateRoomId();
    const room = {
      id: roomId,
      black: { id: existing.playerId },
      white: { id: playerId },
      boardSize,
      layerCount,
      board: null,
      turn: 1,
      gameOver: false,
      lastMove: null,
      created: Date.now(),
    };

    await KV.put(`room:${roomId}`, JSON.stringify(room));
    await KV.delete(queueKey);

    // Store mapping so the waiting player can find their room
    await KV.put(`player-room:${existing.playerId}`, JSON.stringify({ roomId, color: 'black' }), {
      expirationTtl: 300,
    });

    return jsonResponse({ status: 'matched', roomId, color: 'white' });
  }

  // No match — add to queue
  const queueId = `${playerId}-${Date.now()}`;
  await KV.put(queueKey, JSON.stringify({ playerId, queueId, boardSize, layerCount }), {
    expirationTtl: 300,
  });

  return jsonResponse({ status: 'waiting', queueId });
}

export async function onRequestGet(context) {
  const { env } = context;
  const KV = env.GAME_KV;
  const url = new URL(context.request.url);
  const queueId = url.searchParams.get('queueId');
  const playerId = url.searchParams.get('playerId');

  // Queue count mode - return number of waiting players (optionally filtered by game type)
  if (url.searchParams.get('count') === '1') {
    const list = await KV.list({ prefix: 'queue:' });
    const gameType = url.searchParams.get('gameType');
    if (gameType) {
      const filtered = list.keys.filter((k) => k.name.startsWith(`queue:${gameType}:`));
      return jsonResponse({ count: filtered.length });
    }
    return jsonResponse({ count: list.keys.length });
  }

  if (!queueId || !playerId) {
    return jsonResponse({ error: 'Missing queueId or playerId' }, 400);
  }

  // Check if this player has been matched
  const playerRoom = await KV.get(`player-room:${playerId}`, 'json');
  if (playerRoom) {
    await KV.delete(`player-room:${playerId}`);
    return jsonResponse({ status: 'matched', roomId: playerRoom.roomId, color: playerRoom.color });
  }

  return jsonResponse({ status: 'waiting' });
}

export async function onRequestDelete(context) {
  const { env } = context;
  const KV = env.GAME_KV;
  const url = new URL(context.request.url);
  const queueId = url.searchParams.get('queueId');

  if (!queueId) {
    return jsonResponse({ error: 'Missing queueId' }, 400);
  }

  // We need to find and delete the queue entry. queueId contains the playerId.
  // List all queue keys and find the matching one.
  const list = await KV.list({ prefix: 'queue:' });
  for (const key of list.keys) {
    const entry = await KV.get(key.name, 'json');
    if (entry && entry.queueId === queueId) {
      await KV.delete(key.name);
      return jsonResponse({ status: 'deleted' });
    }
  }

  return jsonResponse({ status: 'not_found' }, 404);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
