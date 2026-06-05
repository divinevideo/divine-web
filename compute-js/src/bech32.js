// ABOUTME: bech32 encode/decode helpers for npub <-> hex pubkey conversion
// ABOUTME: Pure JS, no Fastly dependencies. Spec: BIP-173 + NIP-19.

/**
 * Convert hex pubkey to npub (Bech32) format
 */
export function hexToNpub(hex) {
  // Bech32 character set
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  // Convert hex to 5-bit groups
  const data = [];
  for (let i = 0; i < hex.length; i += 2) {
    data.push(parseInt(hex.slice(i, i + 2), 16));
  }

  // Convert 8-bit to 5-bit
  const converted = convertBits(data, 8, 5, true);

  // Compute checksum
  const hrp = 'npub';
  const checksumData = hrpExpand(hrp).concat(converted);
  const checksum = createChecksum(checksumData);

  // Encode
  let result = hrp + '1';
  for (const b of converted.concat(checksum)) {
    result += CHARSET[b];
  }

  return result;
}

export function decodeNpubToHex(npub) {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const normalized = (npub || '').toLowerCase();
  if (!normalized.startsWith('npub1')) {
    return null;
  }

  const separatorIndex = normalized.lastIndexOf('1');
  if (separatorIndex === -1) {
    return null;
  }

  const dataPart = normalized.slice(separatorIndex + 1);
  if (dataPart.length < 6) {
    return null;
  }

  const values = [...dataPart].map(char => CHARSET.indexOf(char));
  if (values.some(value => value === -1)) {
    return null;
  }

  const payload = values.slice(0, -6);
  const decoded = convertBits(payload, 5, 8, false);
  if (!decoded) {
    return null;
  }

  return decoded.map(value => value.toString(16).padStart(2, '0')).join('');
}

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const result = [];
  const maxv = (1 << toBits) - 1;
  const maxAcc = (1 << (fromBits + toBits - 1)) - 1;

  for (const value of data) {
    if (value < 0 || (value >> fromBits) !== 0) {
      return null;
    }
    acc = ((acc << fromBits) | value) & maxAcc;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    return null;
  }

  return result;
}

function hrpExpand(hrp) {
  const result = [];
  for (const c of hrp) {
    result.push(c.charCodeAt(0) >> 5);
  }
  result.push(0);
  for (const c of hrp) {
    result.push(c.charCodeAt(0) & 31);
  }
  return result;
}

function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) {
        chk ^= GEN[i];
      }
    }
  }
  return chk;
}

function createChecksum(data) {
  const values = data.concat([0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const result = [];
  for (let i = 0; i < 6; i++) {
    result.push((mod >> (5 * (5 - i))) & 31);
  }
  return result;
}
