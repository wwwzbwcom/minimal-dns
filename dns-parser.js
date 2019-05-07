
// read data from a Byte b (from start to end)
function readByte(b, start, end) {
    return (b >>> (7 - (end - 1))) & ~(0xff << (end - start));
}

// write data to a Byte b (at pos)
function writeByte(b, data, pos) {
    return b | (data << (8 - pos - digit(data)));
}

// get how many digit b have (in binary)
function digit(b) {
    var cnt = 0;
    while (b != 0) {
        b = b >> 1;
        cnt++;
    }
    return cnt;
}

class SocketMessage {
    fromBuffer() { }
    toBuffer() { }
}

class DNSHeader extends SocketMessage {
    fromBuffer(buf) {
        // ID of the DNSMessage [2 Byte]
        this.id = buf.slice(0, 2);
        
        /** 
         * Query/Respond Code, 0 for query, 1 for answer [1 bit]
         * OP Code [1 bit]
         * Authoritative Answer [1 bit]
         * Truncated, for message is truncated [1 bit]
         * Recursion Desired [1 bit]
         * */ 
        this.qr = readByte(buf[2], 0, 1);
        this.opcode = readByte(buf[2], 1, 5);
        this.aa = readByte(buf[2], 5, 6);
        this.tc = readByte(buf[2], 6, 7);
        this.rd = readByte(buf[2], 7, 8);

        /**
         * Recursion Available [1 bit]
         * Reserve, Should be all 0 [3 bit]
         * Respond Code, For Respond Status [4 bit]
         */
        this.ra = readByte(buf[3], 0, 1);     
        this.z = readByte(buf[3], 1, 4);
        this.rcode = readByte(buf[3], 4, 8);

        /**
         * Questions Count [2 Byte]
         * Answers Count [2 Byte]
         * Authority Records Count [2 Byte]
         * Additional Records Count [2 Byte]
         */
        this.qdcount = buf.slice(4, 6).readUInt16BE();
        this.ancount = buf.slice(6, 8).readUInt16BE();
        this.nscount = buf.slice(8, 10).readUInt16BE();
        this.arcount = buf.slice(10, 12).readUInt16BE();

        // The Length of Header is 12 Bytes
        this.length = 12;

        return this;
    }

    toBuffer() {
        var buf = new Buffer.alloc(12, 0);

        this.id.copy(buf, 0, 0, 2);

        buf[2] = writeByte(buf[2], this.qr, 0);
        buf[2] = writeByte(buf[2], this.opcode, 1);
        buf[2] = writeByte(buf[2], this.aa, 5);
        buf[2] = writeByte(buf[2], this.tc, 6);
        buf[2] = writeByte(buf[2], this.rd, 7);

        buf[3] = writeByte(buf[3], this.ra, 0);
        buf[3] = writeByte(buf[3], this.z, 1);
        buf[3] = writeByte(buf[3], this.rcode, 4);

        buf.writeUInt16BE(this.qdcount, 4);
        buf.writeUInt16BE(this.ancount, 6);
        buf.writeUInt16BE(this.nscount, 8);
        buf.writeUInt16BE(this.arcount, 10);

        return buf;
    }
}

class DNSName extends SocketMessage {
    getLength(buf, offset = 0) {
        // Name is a Pointer to Previous Domain
        if(readByte(buf[offset], offset, offset + 2) == 3)
        {
            return -1;
        }
        // Name is a Domain
        else
        {
            for (var i = offset; i < buf.length;) {
                // First Byte For Next Length
                var len = buf[i];
                i += len + 1;
                if (len == 0) break;
            }
            return i - offset;
        }
    }

    fromBuffer(buf, offset = 0, fullBuf = null) {
        var length = this.getLength(buf, offset);

        // Name is a Pointer to Previous Domain
        if(length == -1)
        {
            this.isPointer = true;
            this.pointer = buf;
            this.length = 2;
            return this;
        }

        // Name is a Domain
        else
        {
            this.isPointer = false;
            this.domain = "";
            for (var i = offset; i < offset + length;) {
                var len = buf[i];
                if (len == 0) break;

                // Decode a Piece of Domain
                this.domain += buf.slice(i + 1, i + len + 1).toString('ascii') + '.';
                i += len + 1;
            }
            this.length = length;
            return this;
        }
    }

    toBuffer() {
        if(this.isPointer == true)
        {
            return this.pointer;
        }
        else
        {
            var parts = this.domain.split('.');
            var offset = 0;
            var buf = "";
            for (var i = 0; i < parts.length; i++) {

                if (parts.length == 0) break;

                buf += String.fromCharCode(parts[i].length);
                for (var j = 0; j < parts[i].length; j++) {
                    buf += parts[i][j];
                }
            }

            return Buffer.from(buf, "ascii");
        }
    }
}

class DNSBody {

    fromBuffer(buf, offset = 0) {

        // Query Domain
        this.name = new DNSName();
        this.name = this.name.fromBuffer(buf.slice(offset));
        var len = this.name.length;

        /**
         * Query Type [2 Byte]
         * Query Class [2 Byte]
         */
        this.type = buf.slice(offset + len, offset + len + 2).readUInt16BE();
        this.class = buf.slice(offset + len + 2, offset + len + 4).readUInt16BE();

        this.length = len + 4;

        return this;
    }

    toBuffer() {
        var nameBuf = this.name.toBuffer();
        var len = nameBuf.length;
        var buf = Buffer.alloc(len + 4);

        nameBuf.copy(buf, 0, 0, len);

        buf.writeUInt16BE(this.type, len);
        buf.writeUInt16BE(this.class, len + 2);
        return buf;
    }
}

class DNSQuestion extends DNSBody {
    constructAnswer(data, dataType) {
        var answer = new DNSAnswer();
        answer.name = this.name;
        answer.type = this.type;
        answer.class = this.class;
        answer.ttl = 1;

        if (dataType == 'ip') {
            answer.rdlength = 4;
            answer.rdata = Buffer.alloc(4);
            
            var parts = data.split('.');
            answer.rdata[0] = parseInt(parts[0]);
            answer.rdata[1] = parseInt(parts[1]);
            answer.rdata[2] = parseInt(parts[2]);
            answer.rdata[3] = parseInt(parts[3]);
        }
        else {
            answer.rdlength = 4;
            answer.rdata = Buffer.alloc(4);

            answer.rdata[0] = 1;
            answer.rdata[1] = 2;
            answer.rdata[2] = 3;
            answer.rdata[3] = 4;
        }

        return answer;
    }

    getId() {
        // domain, type, class identify the Question
        return this.name.domain + "|" + this.type + "|" + this.class;
    }
}

class DNSAnswer extends DNSBody {
    fromBuffer(buf, offset = 0) {
        super.fromBuffer(buf, offset);
        var len = this.length;

        /**
         * Time to Live [4 Byte]
         * Return Data Length [2 Byte]
         * Return Data [rdlenth Byte]
         */
        this.ttl = buf.slice(offset + len, offset + len + 4).readUInt32BE();
        this.rdlength = buf.slice(offset + len + 4, offset + len + 6).readUInt16BE();
        this.rdata = buf.slice(offset + len + 6, offset + len + 6 + this.rdlength);

        len += 6 + this.rdlength;
        this.length = len;

        return this;
    }

    toBuffer() {
        var bodyBuf = super.toBuffer();
        var len = bodyBuf.length;
        var buf = new Buffer.alloc(len + 6 + this.rdlength);

        bodyBuf.copy(buf, 0, 0, len);

        buf.writeUInt32BE(this.ttl, len);
        buf.writeUInt16BE(this.rdlength, len + 4);
        this.rdata.copy(buf, len + 6, 0, this.rdlength);

        return buf;
    }
}

class DNSMessage {

    constructAnswer(data, dataType) {
        this.qr = 1;
        this.header.ancount = 1;
        var answer = this.questions[0].constructAnswer(data, dataType);
        this.answers = [];
        this.answers.push(answer);

    }

    fromBuffer(buf) {

        // Decode the Header
        var offset = 0;
        this.header = new DNSHeader();
        this.header.fromBuffer(buf.slice(0, 12));
        offset += this.header.length;

        // Decode Questions
        this.questions = [];
        for (var i = 0; i < this.header.qdcount; i++) {
            var question = new DNSQuestion();
            question.fromBuffer(buf, offset);

            this.questions.push(question);
            offset += question.length;
        }

        // Decode Answers
        this.answers = [];
        for (var i = 0; i < this.header.ancount; i++) {
            var answer = new DNSAnswer();
            answer.fromBuffer(buf, offset);

            this.answers.push(answer);
            offset += answer.length;
        }

        // Authority or Additional Records are Ignored

        return this;
    }

    toBuffer() {
        var bufs = [];
        bufs.push(this.header.toBuffer());

        for (var i = 0; i < this.header.qdcount; i++) {
            bufs.push(this.questions[i].toBuffer());
        }
        
        
        for (var i = 0; i < this.header.ancount; i++) {
            bufs.push(this.answers[i].toBuffer());
        }
        return Buffer.concat(bufs);
    }
}
module.exports = DNSMessage;

function test() {

    var buf = Buffer.from(
        "de6d01200001000000000001076578616d706c6503636f6d0000010001"
        , "Hex"
    );

    var dns = new DNSMessage();
    dns.fromBuffer(buf);
    console.log(JSON.stringify(dns, null, 2));

    var buf = Buffer.from(
        "85b881000001000100000000076578616d706c6503636f6d0000010001076578616d706c6503636f6d00000100010000000100047f000001"
        , "Hex"
    );

    var dns = new DNSMessage();
    dns.fromBuffer(buf);
    console.log(JSON.stringify(dns, null, 2));
    
    // Test Parsing of Header;
    console.log("============");
    console.log(buf.slice(0, 12));
    console.log(dns.header.toBuffer());

    // Test Parsing of Question;
    console.log("============");
    console.log(buf.slice(12));
    console.log(dns.questions[0].toBuffer());

    // Test Parsing of Answer;
    console.log("============");
    console.log(buf.slice(29));
    console.log(dns.answers[0].toBuffer());
    
    // Test Encode to Buffer;
    console.log("============");
    console.log(buf);
    console.log(dns.toBuffer());
}