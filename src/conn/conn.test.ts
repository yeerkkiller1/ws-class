import { throws, throwIfNotImplementsData } from "../reflection/assert";

describe("types for testing", () => {
    describe("throwIfNotImplementsData", () => {
        it("can throw", () => {
            throws(() => {
                throwIfNotImplementsData({x: 5}, {x: 6});
            });
        });
    });
});