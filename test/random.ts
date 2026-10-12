import { Random } from "../src/random";

function makeMathGlobal() {
    const math = {floor: jest.fn(), random: jest.fn()};
    math.floor.mockImplementationOnce((n) => Math.floor(n));
    return math;
}

function zeroFilledArrayOfInclusiveLength(n: number): number[] {
    const array = [];
    const limit = n + 1;

    for (let i = 0; i < limit; i++) {
        array[i] = 0;
    }

    return array;
}

function differenceToPreviousNeighbour(i: number, array: number[]): number {
    const value = array[i];
    const neighbour = Math.max(i - 1, 0);
    return Math.abs(value - array[neighbour]);
}

function differenceToNextNeighbour(i: number, array: number[]): number {
    const value = array[i];
    const neighbour = Math.min(i + 1, array.length - 1);
    return Math.abs(value - array[neighbour]);
}

describe("the getRandom function", () => {

    it("should be able to return 0", () => {
        const mathGlobal = makeMathGlobal();
        mathGlobal.random.mockReturnValueOnce(0);

        const result = Random.getRandom(1, mathGlobal);

        expect(result).toBe(0);
    });

    it("should be able to return the maximum", () => {
        const mathGlobal = makeMathGlobal();
        mathGlobal.random.mockReturnValueOnce(0.9999999999);

        const result = Random.getRandom(5, mathGlobal);

        expect(result).toBe(5);
    });

    it("should not exhibit significant bias", () => {
        const range = 1000;
        const buckets = zeroFilledArrayOfInclusiveLength(range);
        const mathGlobal = makeMathGlobal();

        for (let i = 0; i < 1; i += 0.001) {
            buckets[Random.getRandom(range, mathGlobal)] += 1;
        }

        buckets.forEach((n) => {
            expect(differenceToPreviousNeighbour(n, buckets)).toBeLessThan(2);
            expect(differenceToNextNeighbour(n, buckets)).toBeLessThan(2);
        });
    });

    it("should not return values outside of the range", () => {
        const range = 1000;
        const buckets = zeroFilledArrayOfInclusiveLength(range);
        const mathGlobal = makeMathGlobal();

        for (let i = 0; i < 1; i += 0.001) {
            buckets[Random.getRandom(range, mathGlobal)] += 1;
        }

        expect(buckets.length).toBe(range + 1);
    });
});

describe("the getRandom16 function", () => {

    it("should limit itself to 16-bit values", () => {
        const rng = jest.fn();

        Random.getRandom16(rng);

        expect(rng).toHaveBeenCalledWith(2 ** 16 - 1);
    });
});

describe("the getRandom16Signed function", () => {

    it("should return positive values below 2^15", () => {
        const valueBelowThreshold = 32767;

        const rng = jest.fn().mockReturnValueOnce(valueBelowThreshold);

        expect(Random.getRandom16Signed(rng)).toBe(valueBelowThreshold);
    });

    it("should return negative values in the interval [-(2^15)..-1]", () => {
        const threshold = 32768;
        const limit = 2 ** 16 - 1;
        const rng = jest.fn().mockReturnValueOnce(threshold).mockReturnValueOnce(limit);

        expect(Random.getRandom16Signed(rng)).toBeLessThan(0);
        expect(Random.getRandom16Signed(rng)).toBeLessThan(0);
    });
});

describe("the getERandom function", () => {

    it("getERandom should respect the given maximum", () => {
        const threshold = 1000;
        const rng = jest.fn().mockReturnValue(1);

        Random.getERandom(threshold, rng);

        expect(rng).toHaveBeenCalledWith(threshold);
    });

    it("getERandom should exhibit a bias towards smaller numbers", () => {
        const threshold = 1000;
        const lower = 1;
        const upper = 2;
        const rng = jest.fn().mockReturnValueOnce(lower).mockReturnValueOnce(upper);

        expect(Random.getERandom(threshold, rng)).toBe(lower);
    });
});

describe("the getChance function", () => {

    it("getChance should return false if the least significant bits match exactly", () => {
        const chanceValue = 0b101;
        const rng = jest.fn().mockReturnValueOnce(0b1101);

        expect(Random.getChance(chanceValue, rng)).toBe(false);
    });

    it("getChance should return false if some of the least significant bits match", () => {
        const chanceValue = 0b11;
        const rng = jest.fn().mockReturnValueOnce(0b1101);

        expect(Random.getChance(chanceValue, rng)).toBe(false);
    });

    it("getChance should return true if none of the least significant bits match", () => {
        const chanceValue = 0b101;
        const rng = jest.fn().mockReturnValueOnce(0b1010);

        expect(Random.getChance(chanceValue, rng)).toBe(true);
    });
});

describe("the seeded generator", () => {
    const draw = (n: number) => Array.from({ length: n }, () => Random.getRandom(1000));

    it("gives the same numbers from the same seed", () => {
        Random.seed(2026);
        const first = draw(20);
        Random.seed(2026);
        expect(draw(20)).toEqual(first);
        Random.seed(2027);
        expect(draw(20)).not.toEqual(first);
    });

    it("carries on from a saved state", () => {
        Random.seed(7);
        draw(5);
        const saved = Random.getState();
        const after = draw(10);
        Random.seed(99);
        expect(Random.setState(saved)).toBe(true);
        expect(draw(10)).toEqual(after);
    });

    it("ignores a saved state that is not a 32-bit whole number", () => {
        Random.seed(5);
        const state = Random.getState();
        for (const bad of [undefined, null, "12", -1, 1.5, 2 ** 32, NaN]) expect(Random.setState(bad)).toBe(false);
        expect(Random.getState()).toBe(state);
    });

    it("spreads its numbers evenly over [0, 1)", () => {
        Random.seed(1);
        let sum = 0;
        let low = 0;
        for (let i = 0; i < 20000; i++) {
            const value = Random.next();
            expect(value >= 0 && value < 1).toBe(true);
            sum += value;
            if (value < 0.1) low++;
        }
        expect(sum / 20000).toBeCloseTo(0.5, 1);
        expect(low / 20000).toBeCloseTo(0.1, 1);
    });
});
