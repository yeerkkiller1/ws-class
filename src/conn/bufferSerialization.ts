import { mapRecursive } from "../controlFlow/map";

const bufferSpecialPlaceholder = "bufferSpecialPlaceholderybeefpcvorwzyeqpeiuheilqydxsiczm";

export class BufferSerialization<T extends ({ [key in keyof T]: Types.AnyAllNoObjectBuffer } | Types.AnyAllNoObjectBuffer)> {
    constructor(
        private sendObject: (packet: Types.AnyAllNoObject) => void,
        private sendBuffer: (packet: Buffer) => void,
    ) { }

    pendingBuffers: Buffer[] = [];
    public Received(obj: Types.AnyAllNoObject | Buffer): { obj: T } | null {
        // If obj is a Buffer, we need to keep it in a list, until we get a non buffer, and then go through the object,
        //  find all special placeholders, and fill them in from the buffer list.

        if(obj instanceof Buffer) {
            this.pendingBuffers.push(obj);
            return null;
        }

        let buffers = this.pendingBuffers;
        this.pendingBuffers = [];

        let newObj = mapRecursive<Types.AnyAllNoObjectBuffer>(
            obj,
            x => {
                if(x === bufferSpecialPlaceholder) {
                    let buf = buffers.shift();
                    if(buf === undefined) {
                        throw new Error(`Tried to repopulate object with buffers, but we ran out of buffers while repopulating it.`);
                    }
                    return { terminalLeaf: buf };
                } else {
                    return "recurse";
                }
            }
        );

        if(buffers.length > 0) {
            throw new Error(`Tried to repopulate object with buffers, but we received too many buffers while repopulating it.`);
        }

        return { obj: newObj as T };
    }

    public Send(obj: T): void {
        this.send(obj);
    }

    private send(obj: Types.AnyAllNoObjectBuffer) {
        // We need to take any Buffers, send them, replace the buffers in obj with special placeholders

        let buffers: Buffer[] = [];

        let newObj = mapRecursive<Types.AnyAllNoObject>(
            obj,
            x => {
                if(x instanceof Buffer) {
                    buffers.push(x);
                    return { terminalLeaf: bufferSpecialPlaceholder };
                }
                return "recurse";
            }
        );

        for(let buf of buffers) {
            this.sendBuffer(buf);
        }

        this.sendObject(newObj);
    }
}