const {DNSServer, DNSRecord} = require('./dns-server');

// Google DNS Server
var googleDns = {
    address: '8.8.8.8',
    port: 53
};

// Alibaba DNS Server
var aliDns = {
    address: '223.5.5.5',
    port: 53
};

var dnsServer = new DNSServer(googleDns);

// Add Some Testing Records
dnsServer.addRecord(new DNSRecord("example.com.", "1.1.1.1"));
dnsServer.addRecord(new DNSRecord("myself.com.", "127.0.0.1"));