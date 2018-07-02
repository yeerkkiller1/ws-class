let UID = Math.random();
let nextId = 0;
export function randomUID(prefix = "UID") {
    return prefix + (+new Date()).toString() + "." + (nextId++);
}

export class ConnHolder<PacketType extends Packets> implements Conn {
    constructor(
        private send: (packet: PacketType) => void,
        private close: () => void,
        private isDefinitelyDead = () => false,
        private id = randomUID("ConnHolder_"),
        private isOpen = true
    ) { }

    GetLocalId(): string {
        //if(!NODE) throw new Error("Cannot call GetLocalId in chrome. You should inspect a packet to see where it came from, as the connection to you is always going to the same id independent of the source.");
        return this.id;
    }

    closeCalled = false;

    nextCallbackId: number = 0;

    callbacks: { [id: string]: (packet: PacketType) => void } = {};
    Subscribe(callback: (packet: PacketType) => void): UnsubscribeId {
        let callbackId = this.nextCallbackId++ + "";
        this.callbacks[callbackId] = callback;
        return callbackId;
    }
    Unsubscribe(id: UnsubscribeId): void {
        delete this.callbacks[id];
    }
    _OnMessage(packet: PacketType) {
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

    queuedPackets: PacketType[] = [];
    _OnOpen() {
        if(this.isOpen) {
            throw new Error("Is open called multiple times");
        }
        this.isOpen = true;

        // Packets in OnOpen callbacks need to be sent before other packets, or else you OnOpen handlers are pointless.
        let packetsBeforeOpen: PacketType[] = this.queuedPackets;
        this.queuedPackets = [];

        let callbacks = this.callbacksOnOpen;
        this.callbacksOnOpen = {};

        for(let key in callbacks) {
            var callback = callbacks[key];
            callback();
        }

        let queuedPackets = this.queuedPackets;
        for(let i = 0; i < queuedPackets.length; i++) {
            this.send(queuedPackets[i]);
        }
        for(let i = 0; i < packetsBeforeOpen.length; i++) {
            this.send(packetsBeforeOpen[i]);
        }
    }

    Send(packet: PacketType): void {
        if(this.closeCalled) throw new Error("Permanently closed.");
        Object.assign(packet, {
            SourceId: packet.SourceId.concat(this.GetLocalId())
        });
        if(!this.isOpen) {
            this.queuedPackets.push(packet);
            return;
        }
        this.send(packet);
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