import { g } from "../reflection/misc";

export function setDefaultTimeout(timeout: number) {
    g.PROMISE_defaultTimeout = timeout;
}

export function createPromiseStream<T>(
    /** -1 means infinite */
    promiseErrorTimeout: number = g.PROMISE_defaultTimeout
): {
    getPromise(): Promise<T>;
    sendValue(val: T|Promise<T>): void;
    throwErr(err: any): void;
} {
    if(promiseErrorTimeout === undefined) {
        promiseErrorTimeout = -1;
    }
    let vals: (
        // A promise represents a value received, and a function represents a value request.
        //  The list should only contain one type (if it doesn't, the requests and received can/should be collapsed!)
        Promise<T>|{resolve: (val: T|Promise<T>) => void, reject: (err: any) => void}
    )[] = [];

    return {
        getPromise() {
            // Try to take a received val
            let valObj = vals.shift();
            if(valObj && valObj instanceof Promise) {
                return valObj;
            }
            // If we took a val request, put it back where we found it
            if(valObj) {
                vals.splice(0, 0, valObj);
            }
            
            // Make a new val request
            return new Promise<T>((resolve, reject) => {
                let finished = false;
                if(promiseErrorTimeout !== -1) {
                    setTimeout(() => {
                        if(!finished) {
                            finished = true;
                            reject(new Error("Promise request timed out"));
                        }
                    }, promiseErrorTimeout);
                }
                vals.push({
                    resolve: (val) => {
                        if(finished) {
                            console.warn(`Received val on promise that already timed out.`);
                            return;
                        }
                        finished = true;
                        resolve(val);
                    },
                    reject: (err) => {
                        if(finished) {
                            console.warn(`Received val on promise that already timed out.`);
                            return;
                        }
                        finished = true;
                        reject(err);
                    }
                });
            });
        },
        sendValue(val) {
            // Try to take a val request
            let valObj = vals.shift();
            if(valObj && !(valObj instanceof Promise)) {
                valObj.resolve(val);
                return;
            }
            // If we took a val received, put it back where we found it
            if(valObj) {
                vals.splice(0, 0, valObj);
            }
            
            // Add a new val received
            vals.push(new Promise<T>(resolve => {
                resolve(val);
            }));
        },
        throwErr(err) {
            let valObj = vals.shift();
            if(valObj && !(valObj instanceof Promise)) {
                valObj.reject(err);
                return;
            }
            // If we took a val received, put it back where we found it
            if(valObj) {
                vals.splice(0, 0, valObj);
            }
            
            // Add a new val received
            vals.push(new Promise<T>((resolve, reject) => {
                reject(err);
            }));
        },
    };
}

export function setTimeoutAsync(time: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}