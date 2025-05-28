import net from 'net';
import { Pool } from 'pg';

const PORT = 4000;

const server = net.createServer(socket => {
  let buffer = '';
  let pool = null; // Pool will be created once 'c' message arrives

  socket.on('data', data => {
    buffer += data.toString();

    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
      const mode = buffer.substring(0, 1);
      const jsonStr = buffer.substring(1, boundary);
      buffer = buffer.substring(boundary + 1);

      try {
        if (mode === 'c') {
          // 'c' mode: create a new pool with config from JSON
          const config = JSON.parse(jsonStr);
          // Close existing pool if any
          if (pool) {
            pool.end().catch(e => console.error('Error closing previous pool:', e));
          }
          pool = new Pool(config);
          socket.write(JSON.stringify({ success: true, message: 'Pool created' }) + '\n');

        } else if (mode === 'q') {
          // 'q' mode: query using the existing pool
          if (!pool) {
            throw new Error('Pool not initialized. Send "c" message first with config.');
          }

          const input = JSON.parse(jsonStr);

          if (!Array.isArray(input)) {
            socket.write(JSON.stringify({ success: false, error: 'Queries must be an array' }) + '\n');
            boundary = buffer.indexOf('\n');
            continue;
          }

          const queries = input.map(arr => ({
            text: arr[0],
            params: arr[1] || []
          }));

          const promises = queries.map(q => {
            if (typeof q === 'string') {
              return pool.query(q).then(res => res.rows);
            } else if (q.text && Array.isArray(q.params)) {
              return pool.query(q.text, q.params).then(res => res.rows);
            } else {
              return Promise.reject(new Error('Invalid query format'));
            }
          });

          Promise.all(promises)
            .then(results => {
              socket.write(JSON.stringify({ success: true, results }) + '\n');
            })
            .catch(err => {
              socket.write(JSON.stringify({ success: false, error: err.message }) + '\n');
            });

        } else {
          throw new Error(`Unsupported mode: ${mode}`);
        }

      } catch (err) {
        console.error('Error processing data:', err);
        socket.write(JSON.stringify({ success: false, error: err.message }) + '\n');
      }

      boundary = buffer.indexOf('\n');
    }
  });

  socket.on('error', err => {
    console.error('Socket error:', err);
  });

  socket.on('close', () => {
    console.log('Client disconnected');
    if (pool) {
      pool.end().catch(e => {
        console.error('Error closing pool:', e);
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`PostgreSQL TCP server listening on port ${PORT}`);
});
