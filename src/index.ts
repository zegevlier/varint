import { Hono } from "hono";

const SEGMENT_BITS: number = 0x7f;
const CONTINUE_BIT: number = 0x80;

class Packet {
  public buffer: number[];

  constructor(buffer: number[]) {
    this.buffer = buffer;
  }

  protected writeByte(value: number): void {
    this.writeBytes([value]);
  }

  protected writeBytes(value: number[]): void {
    this.buffer.push(...value);
  }

  protected readByte(): number {
    let r = this.buffer.shift();
    if (r === undefined) {
      console.log("Failed to read byte");
      throw new Error("Failed to read byte");
    }
    return r;
  }

  public writeVarInt(input: number) {
    let value = input;
    while (true) {
      if ((value & ~SEGMENT_BITS) === 0) {
        this.writeByte(value);
        return;
      }
      this.writeByte((value & SEGMENT_BITS) | CONTINUE_BIT);
      value >>>= 7;
    }
  }

  public readVarInt(): number {
    let value = 0;
    let position = 0;
    let currentByte;

    while (true) {
      currentByte = this.readByte();
      // console.log('currentByte', currentByte);
      // console.log('array length: ', this.buffer.length);
      value |= (currentByte & SEGMENT_BITS) << position;

      if ((currentByte & CONTINUE_BIT) === 0) {
        break;
      }

      position += 7;

      if (position >= 32) {
        throw new Error('VarInt too big :(');
      }
    }

    return value;
  }
}

function changeEndianness(string: string): string {
  const result = [];
  let len = string.length - 2;
  while (len >= 0) {
    result.push(string.slice(len, len + 2));
    len -= 2;
  }
  return result.join('');
}

const app = new Hono();

app.get("/", (c) => {
  return c.html(`
<html>
<body>
<h1>Varint converter</h1>
<form action="/read" method="get">
<input type="text" placeholder="0xdd 0xc7 0x01" name="data" />
<input type="submit" value="Read" />
</form>
<form action="/write" method="get">
<input type="text" placeholder="25565" name="data" />
<input type="submit" value="Write" />
</form>
</body>
</html>
`);
})

app.get("/read", (c) => {
  const data = c.req.query("data");
  const numbers = data.split(",").flatMap(x => x.split(" ")).flatMap(x => x.split("+")).map(x => parseInt(x));
  console.log('numbers', numbers);
  const packet = new Packet(numbers);
  return c.text(`${packet.readVarInt().toString()}`);
})

app.get("/write", (c) => {
  const data = c.req.query("data");
  console.log('data', data);
  const packet = new Packet([]);
  packet.writeVarInt(parseInt(data));
  return c.text(`${packet.buffer.map((n) => "0x" + n.toString(16)).join(",")}`);
})

export default app;
