import { BufferSerialization } from "./bufferSerialization";

let UID = Math.random();
let nextId = 0;
export function randomUID(prefix = "UID") {
    return prefix + (+new Date()).toString() + "." + (nextId++);
}


export class ConnHolder implements Conn {
    constructor(
        private sendObject: (packet: Types.AnyAllNoObject) => void,
        private sendBuffer: (packet: Uint8Array) => void,
        private close: () => void,
        private isDefinitelyDead = () => false,
        private id = randomUID("ConnHolder_"),
        private isOpen = true
    ) { }

    bufferSerialization = new BufferSerialization<Packet>(
        this.sendObject,
        this.sendBuffer
    );

    GetLocalId(): string {
        //if(!NODE) throw new Error("Cannot call GetLocalId in chrome. You should inspect a packet to see where it came from, as the connection to you is always going to the same id independent of the source.");
        return this.id;
    }

    closeCalled = false;

    nextCallbackId: number = 0;

    callbacks: { [id: string]: (packet: Packet) => void } = {};
    Subscribe(callback: (packet: Packet) => void): UnsubscribeId {
        let callbackId = this.nextCallbackId++ + "";
        this.callbacks[callbackId] = callback;
        return callbackId;
    }
    Unsubscribe(id: UnsubscribeId): void {
        delete this.callbacks[id];
    }
    _OnMessage(inputObj: Types.AnyAllNoObject | Uint8Array) {
        let obj = this.bufferSerialization.Received(inputObj);
        if(obj === null) return;
        let packet: Packet = obj.obj;
        for(let key in this.callbacks) {
            let callback = this.callbacks[key];
            callback(packet);
        }
    }

    callbacksOnOpen: { [id: string]: () => void } = {};
    SubscribeOnOpen(callbackId: string, callback: () => void): void {
        if(this.isOpen) {
            callback();
            return;
        }
        this.callbacksOnOpen[callbackId] = callback;
    }
    UnsubscribeOnOpen(id: UnsubscribeId): void {
        delete this.callbacksOnOpen[id];
    }

    queuedPackets: Packet[] = [];
    _OnOpen() {
        if(this.isOpen) {
            throw new Error("Is open called multiple times");
        }
        this.isOpen = true;

        // Packets in OnOpen callbacks need to be sent before other packets, or else you OnOpen handlers are pointless.
        let packetsBeforeOpen: Packet[] = this.queuedPackets;
        this.queuedPackets = [];

        let callbacks = this.callbacksOnOpen;
        this.callbacksOnOpen = {};

        for(let key in callbacks) {
            var callback = callbacks[key];
            callback();
        }

        let queuedPackets = this.queuedPackets.concat(packetsBeforeOpen);
        for(let packet of queuedPackets) {
            this.bufferSerialization.Send(packet);
        }
    }

    Send(packet: Packet): void {
        if(this.closeCalled) throw new Error("Permanently closed.");
        Object.assign(packet, {
            SourceId: packet.SourceId.concat(this.GetLocalId())
        });
        if(!this.isOpen) {
            this.queuedPackets.push(packet);
            return;
        }
        this.bufferSerialization.Send(packet);
    }

    callbacksOnClose: { [id: string]: () => void } = {};
    SubscribeOnClose(callbackId: string, callback: () => void): void {
        if(!this.isOpen) {
            callback();
            return;
        }
        this.callbacksOnClose[callbackId] = callback;
    }
    UnsubscribeOnClose(id: UnsubscribeId): void {
        delete this.callbacksOnClose[id];
    }

    _OnClose() {
        this.isOpen = false;

        let callbacks = this.callbacksOnClose;
        this.callbacksOnClose = {};

        for(let key in callbacks) {
            var callback = callbacks[key];
            callback();
        }
    }

    /** Closing is permenant. If you call Close, Reconnect MUST not reconnect. */
    Close(): void {
        if(this.closeCalled) return;
        this.closeCalled = true;
        this.close();
    }

    IsDead() {
        return this.closeCalled || this.isDefinitelyDead();
    }
}