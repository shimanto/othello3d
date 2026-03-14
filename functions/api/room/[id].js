const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const KV = env.GAME_KV;
  const roomId = params.id;
  const url = new URL(context.request.url);
  const playerId = url.searchParams.get('playerId');

  const room = await KV.get(`room:${roomId}`, 'json');
  if (!room) {
    return jsonResponse({ error: 'Room not found' }, 404);
  }

  let color = null;
  if (playerId) {
    if (room.black && room.black.id === playerId) {
      color = 'black';
    } else if (room.white && room.white.id === playerId) {
      color = 'white';
    }
  }

  return jsonResponse({ ...room, color });
}

export async function onRequestPut(context) {
  const { env, params } = context;
  const KV = env.GAME_KV;
  const roomId = params.id;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const room = await KV.get(`room:${roomId}`, 'json');
  if (!room) {
    return jsonResponse({ error: 'Room not found' }, 404);
  }

  const { action, playerId } = body;

  if (action === 'join') {
    if (!playerId) {
      return jsonResponse({ error: 'Missing playerId' }, 400);
    }

    // Check if player is already in the room
    if ((room.black && room.black.id === playerId) || (room.white && room.white.id === playerId)) {
      const color = room.black && room.black.id === playerId ? 'black' : 'white';
      return jsonResponse({ ...room, color });
    }

    // Try to fill an empty slot
    if (!room.black) {
      room.black = { id: playerId };
      await KV.put(`room:${roomId}`, JSON.stringify(room));
      return jsonResponse({ ...room, color: 'black' });
    } else if (!room.white) {
      room.white = { id: playerId };
      await KV.put(`room:${roomId}`, JSON.stringify(room));
      return jsonResponse({ ...room, color: 'white' });
    } else {
      return jsonResponse({ error: 'Room is full' }, 409);
    }
  }

  if (action === 'stamp') {
    if (!playerId || !body.stamp) {
      return jsonResponse({ error: 'Missing playerId or stamp' }, 400);
    }
    room.lastStamp = { from: playerId, stamp: body.stamp, ts: Date.now() };
    await KV.put(`room:${roomId}`, JSON.stringify(room));
    return jsonResponse({ status: 'ok' });
  }

  if (action === 'move') {
    if (!playerId) {
      return jsonResponse({ error: 'Missing playerId' }, 400);
    }

    // Determine player's color
    let playerColor = null;
    if (room.black && room.black.id === playerId) {
      playerColor = 'black';
    } else if (room.white && room.white.id === playerId) {
      playerColor = 'white';
    }

    if (!playerColor) {
      return jsonResponse({ error: 'Player not in room' }, 403);
    }

    // Check if it's the player's turn (turn 1 = black, turn -1 = white)
    const expectedColor = room.turn === 1 ? 'black' : 'white';
    if (playerColor !== expectedColor) {
      return jsonResponse({ error: 'Not your turn' }, 403);
    }

    room.board = body.board;
    room.turn = body.turn;
    room.gameOver = body.gameOver;
    room.lastMove = body.lastMove;

    await KV.put(`room:${roomId}`, JSON.stringify(room));
    return jsonResponse({ ...room, color: playerColor });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const KV = env.GAME_KV;
  const roomId = params.id;
  const url = new URL(context.request.url);
  const playerId = url.searchParams.get('playerId');

  if (!playerId) {
    return jsonResponse({ error: 'Missing playerId' }, 400);
  }

  const room = await KV.get(`room:${roomId}`, 'json');
  if (!room) {
    return jsonResponse({ error: 'Room not found' }, 404);
  }

  if (room.black && room.black.id === playerId) {
    room.black.disconnected = true;
  } else if (room.white && room.white.id === playerId) {
    room.white.disconnected = true;
  } else {
    return jsonResponse({ error: 'Player not in room' }, 403);
  }

  await KV.put(`room:${roomId}`, JSON.stringify(room));
  return jsonResponse({ status: 'disconnected' });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
