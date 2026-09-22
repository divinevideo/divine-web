# Supporter recognition handoff

## Objective and status

Make paid supporter membership visible to its owner, provide explicit public recognition consent, and explain how to join and proceed toward verification. Implementation is ready for integration on `feat/supporter-recognition`; the coordinating agent owns push, PR, and reviewer requests.

## Verification

- [VERIFIED] `TZ=UTC npm run test`: typecheck, lint (16 existing warnings), 340 test files / 2,939 tests, production build passed.
- [VERIFIED] Supporter browser checks passed at 390px, 1280px, and French 320px, including no horizontal overflow and page-content accessibility. A synthetic local-key account displayed thanks and saved recognition while preserving the other preference fields.
- [VERIFIED] Final TypeScript check and focused lint passed after button wrapping changes.
- [VERIFIED] The existing snapshot recovery test assumes UTC calendar dates and fails in Pacific/Auckland; no unrelated test change was made.

## Current mental model

- Private state is authenticated with NIP-98 and account-scoped query keys. Verify the signed public key matches the selected account before sending either GET or PATCH: extension signers can change their selected key independently.
- Hosted sessions and `NUser.method === 'nsec'` may refresh automatically. External signers require explicit checks. Do not use `instanceof NSecSigner`: the login dependency imports a separately bundled alias of the same package.
- Unknown, failed, and unchecked signed-in state must never turn into an instruction to purchase again.
- Public profile chips use only the public recognition endpoint. An owner's private chip and thanks do not opt them into public recognition.
- PATCH sends all three boolean preferences; the profile chip switch changes only `haloVisible`.
- The web page sends purchases/restores to the native app. Existing linked-account proof tools remain unchanged; membership never grants verified status.

## Integration dependency

- [UNVERIFIED] Production deployment of the new public lookup and browser CORS is owned by the companion `divine-supporters` change. The public contract is GET `/v1/public/supporters?pubkeys=<full-hex-key>` returning `{supporters:[{pubkey,haloVisible:true}]}` only for active opted-in supporters.
- [VERIFIED] Local browser validation used synthetic fixtures, not a real paid account or production write.

## Next steps

Review the final commit, push the branch, open the web PR, and request the normal reviewer team. Coordinate the supporter Worker deployment before enabling the web read path in production. Remove this handoff file once integration is complete.
