import { throws, throwIfNotImplementsData } from "./assert";

describe("types for testing", () => {
    describe("throwIfNotImplementsData", () => {
        it("can throw", () => {
            throws(() => {
                throwIfNotImplementsData({x: 5}, {x: 6});
            });
        });

        it("can throw when extra array element", () => {
            throws(() => {
                throwIfNotImplementsData([1], []);
            });
        });

        it("can throw when missing array element", () => {
            throws(() => {
                throwIfNotImplementsData([], [1]);
            });
        });

        it("can throw when array instead of object", () => {
            throws(() => {
                throwIfNotImplementsData([], {});
            });
        });
        it("can throw when object instead of array", () => {
            throws(() => {
                throwIfNotImplementsData({}, []);
            });
        });
    });
});