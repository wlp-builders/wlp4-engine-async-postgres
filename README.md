# wlp4-engine-async-postgres
Unlock Fast Async Postgres Queries for (WLP4) PHP Swoole with a TCP Server (NodeJS) that uses multiple DB connections simultatiously (Pools). 

Made because Swoole's Postgres extension (publicly archived) didn't solve our problem for WhiteLabelPress V4 - https://reddit.com/r/Whitelabelpress

## Install & Use
```
git clone https://github.com/wlp-builders/wlp4-engine-async-postgres
cd wlp4-engine-async-postgres
npm install
node app.js # runs on localhost:4000
```

## PHP example & Socket protocol
The server accepts 'q' (queries) or 'c' (connect) followed by JSON for the info.
```
<?php

function async_pg_connect(array $config, $usingSwoole = false) {
    $host = '127.0.0.1';
    $port = 4000;

    if ($usingSwoole) {
        // Assuming $client is a Swoole\Client instance
        $client = new Swoole\Client(SWOOLE_SOCK_TCP);
        if (!$client->connect($host, $port, 0.5)) {
            throw new Exception("Swoole client connection failed");
        }
    } else {
        $client = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
        if ($client === false) {
            throw new Exception("Socket creation failed: " . socket_strerror(socket_last_error()));
        }
        if (!socket_connect($client, $host, $port)) {
            $err = socket_strerror(socket_last_error($client));
            socket_close($client);
            throw new Exception("Connection failed: $err");
        }
    }

    // Send 'c' + config JSON to create pool
    $msg = 'c' . json_encode($config) . "\n";

    if ($usingSwoole) {
        $client->send($msg);
    } else {
        socket_write($client, $msg, strlen($msg));
    }

    $response = '';
    while (true) {
        if ($usingSwoole) {
            $chunk = $client->recv();
        } else {
            $chunk = socket_read($client, 2048, PHP_NORMAL_READ);
        }
        if ($chunk === false || $chunk === '') {
            if (!$usingSwoole) socket_close($client);
            throw new Exception("Connection closed or error while reading");
        }
        $response .= $chunk;
        if (strpos($response, "\n") !== false) break;
    }

    $response = trim($response);
    $result = json_decode($response, true);
    if (!$result || empty($result['success'])) {
        if (!$usingSwoole) socket_close($client);
        throw new Exception("Pool creation failed: " . ($result['error'] ?? 'Unknown error'));
    }

    return $client;
}

function async_pg_query($client, array $queries, $usingSwoole = false) {
    $msg = 'q' . json_encode($queries) . "\n";

    if ($usingSwoole) {
        $client->send($msg);
    } else {
        socket_write($client, $msg, strlen($msg));
    }

    $response = '';
    while (true) {
        if ($usingSwoole) {
            $chunk = $client->recv();
        } else {
            $chunk = socket_read($client, 2048, PHP_NORMAL_READ);
        }
        if ($chunk === false || $chunk === '') {
            if (!$usingSwoole) socket_close($client);
            throw new Exception("Connection closed or error while reading");
        }
        $response .= $chunk;
        if (strpos($response, "\n") !== false) break;
    }

    $response = trim($response);
    $result = json_decode($response, true);
    if ($result === null) {
        throw new Exception("Failed to decode response JSON");
    }

    return $result;
}

function async_pg_close($client, $usingSwoole = false) {
    if ($usingSwoole) {
        $client->close();
    } else {
        socket_close($client);
    }
}

//*
// Usage example:
try {
    $config = [
        'database' => 'YOUR_DB_NAME',
        'user' => 'YOUR_DB_USER',
        'password' => 'YOUR_DB_PASSWORD',
        'host' => 'localhost',
        'port' => 5432,
    ];

    $client = async_pg_connect($config);

    $req = [
        //['SELECT * FROM wlp_users WHERE user_login = $1', ['admin']],
        ['SELECT * FROM wlp_posts'],
    ];

    $result = async_pg_query($client, $req);
    print_r($result);

    async_pg_close($client);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
//*/
```

## License Apache2
If you can, join/share our Reddit community! https://reddit.com/r/whitelabelpress
