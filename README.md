# minimal-dns

A minimal DNS parser and server write by Node.js. Best for learning structure of DNS message.

## Dependencies

Node.js

## Usage

### Example

There is a basic example in `main.js`

simply run

```bash
node main
```

under the project directory you can start a dns server on your ip (redirecting the google DNS).

### DNS Parser

Using

```js
const DNSMessage = require('./dns-parser');
```

you can import the `DNSMessage` class, it has `toBuffer()` and `fromBuffer()` methods that can parse DNS message from Buffer, or encode DNS Message to Buffer.

### DNSServer

Using
```js
const { DNSServer, DNSRecord } = require('./dns-server');
```

you can import the `DNSServer` class。

With

```js
var dnsServer = new DNSServer();
```

you can start a DNS Server on `0.0.0.0:53` (Port 53 of all available IPs on your computer).

The `DNSServer` class has a `addRecord` method, With

```js
dnsServer.addRecord(new DNSRecord("example.com.", "1.1.1.1"));
```

you can add a custom DNS Records to your DNS Server.

## Functions

### DNS Parser

[x] Parse DNS Message From Socket Message
[x] Encode DNS Message to Socket Message

### DNS Server

[x] Can add Custom DNS Records
[x] Can setup a remote DNS Server and redirect the query (When missing custom DNS Records)