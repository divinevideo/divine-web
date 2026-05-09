import { adjectives, animals } from './generatedNameDictionaries';

const UINT64_BITS = 64;
const MIX_MULTIPLIER = 0xffff_da61n;
const UINT32_RANGE = 1n << 32n;

function toInt64(value: bigint): bigint {
  return BigInt.asIntN(UINT64_BITS, value);
}

function unsignedShiftRight64(value: bigint, bits: number): bigint {
  return BigInt.asUintN(UINT64_BITS, value) >> BigInt(bits);
}

function foldSeed(pubkey: string): bigint {
  let seed = 0n;
  for (let i = 0; i < pubkey.length; i++) {
    seed = toInt64(seed * 31n + BigInt(pubkey.charCodeAt(i)));
  }
  return seed;
}

function setupSeed(seed: bigint): bigint {
  let value = seed;
  value = toInt64(~value + (value << 21n));
  value = toInt64(value ^ unsignedShiftRight64(value, 24));
  value = toInt64(value * 265n);
  value = toInt64(value ^ unsignedShiftRight64(value, 14));
  value = toInt64(value * 21n);
  value = toInt64(value ^ unsignedShiftRight64(value, 28));
  value = toInt64(value + (value << 31n));

  return value === 0n ? 0x5a17n : value;
}

function nextState(state: bigint): bigint {
  const stateLo = BigInt.asUintN(32, state);
  const stateHi = unsignedShiftRight64(state, 32);
  return toInt64((MIX_MULTIPLIER * stateLo) + stateHi);
}

function nextInt(state: bigint, max: number): [bigint, number] {
  let next = state;

  while (true) {
    next = nextState(next);
    const rnd32 = Number(BigInt.asUintN(32, next));
    const result = rnd32 % max;
    if (BigInt(rnd32 - result + max) <= UINT32_RANGE) {
      return [next, result];
    }
  }
}

function capitalize(word: string): string {
  return `${word[0].toUpperCase()}${word.slice(1)}`;
}

/** Generate deterministic fallback matching mobile generatedNameFor. */
export function genUserName(pubkey: string): string {
  let state = setupSeed(foldSeed(pubkey));

  state = nextState(state);
  state = nextState(state);
  state = nextState(state);
  state = nextState(state);

  const adjectiveResult = nextInt(state, adjectives.length);
  state = adjectiveResult[0];
  const adjectiveIndex = adjectiveResult[1];

  const animalResult = nextInt(state, animals.length);
  state = animalResult[0];
  const animalIndex = animalResult[1];

  const numberResult = nextInt(state, 99);
  const number = numberResult[1];

  return `${capitalize(adjectives[adjectiveIndex])} ${capitalize(animals[animalIndex])} ${number + 1}`;
}