const dgram = require('dgram');
const DNSMessage = require('./dns-parser');

// A Domain to Ip Record (A Record)
class DNSRecord {
    constructor(name, data, type = 1, clss = 1, dataType = "ip") {
        this.name = name;
        this.type = type;
        this.class = clss;

        this.data = data;
        this.dataType = dataType;
    }

    getId() {
        return this.name + "|" + this.type + "|" + this.class;
    }
}


// DNSServer
class DNSServer {

    constructor(remoteServerInfo = null, serverInfo = { address: '0.0.0.0', port: 53 }, timeout = 1000) {
        this.remoteServerInfo = remoteServerInfo;
        this.serverInfo = serverInfo;
        this.timeout = timeout;
        this.records = {};
        this.requests = {};

        // Create a UDP server
        this.server = dgram.createSocket('udp4');

        // When server receive message
        this.server.on('message', (msg, info) => {

            var dns = new DNSMessage();

            // Try to Parse it
            try {
                dns.fromBuffer(msg);
            }
            catch (err) {
                console.warn("Parse Message Error!");
                console.warn(err);
                return;
            }

            // DNS Message is a Query
            if (dns.header.qr == 0) {
                // Try to response it
                dns = this.response(dns, info);
                if (dns != null) {
                    var buf = dns.toBuffer();
                    this.server.send(buf, info.port, info.address);
                }
                return dns;
            }
            // DNS Message is an Answer
            else {
                // Check if it is from the Remote Server
                if (info.address == remoteServerInfo.address && info.port == remoteServerInfo.port) {
                    // Find the Corresponding Query and Respond
                    var rinfo = this.requests[dns.header.id];
                    rinfo.hasRespond = true;

                    dns.header.ra = 0;
                    dns.header.id = rinfo.id;
                    dns.header.nscount = 0;
                    dns.header.arcount = 0;

                    if (dns.header.ancount == 0) {
                        dns.header.rcode = 3;
                    }
                    this.server.send(dns.toBuffer(), rinfo.port, rinfo.address);
                }
                return dns;
            }


        });

        // Start the Server
        this.server.bind({ address: this.serverInfo.address, port: this.serverInfo.port }, (err) => {
            if (!err) {
                console.log("DNS Server Start!");
            }
            else {
                console.log(err);
            }
        });
    }

    response(dns, rinfo) {
        // Only Respond the DNS Message that has only ONE Query
        if (dns.header.qdcount == 1) {

            var question = dns.questions[0];
            var record = this.records[question.getId()];

            // Local Record Exists
            if (record) {
                dns.header.qr = 1;
                if(record.dataType == 'ip' && record.data == "0.0.0.0")
                {
                    dns.header.nscount = 0;
                    dns.header.arcount = 0;
                    dns.rcode = 3;
                }
                else
                {
                    dns.header.nscount = 0;
                    dns.header.arcount = 0;
                    dns.answer = dns.constructAnswer(record.data, record.dataType);
                }
            }
            // Local Record Missing
            else {

                if (this.remoteServerInfo) {
                    //console.log(dns.header.id);
                    rinfo.id = dns.header.id;
                    dns.header.id = Buffer.alloc(2);
                    dns.header.id[0] = Math.round(Math.random() * 256);
                    dns.header.id[1] = Math.round(Math.random() * 256);
                    this.requests[dns.header.id] = rinfo;
                    var buf = dns.toBuffer();
                    this.server.send(buf, this.remoteServerInfo.port, this.remoteServerInfo.address);
                    return null;
                }
                else {
                    dns.header.rcode = 3;
                }

            }

        }
        else {
            dns.header.rcode = 1;
        }

        return dns;
    }

    addRecord(record) {
        this.records[record.getId()] = record;
    }
}


module.exports = {
    DNSServer: DNSServer,
    DNSRecord: DNSRecord
}