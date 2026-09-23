// Fixture message rows seeded from the real /api/flows sample
// (.agent-runs/2026-09-17-extend-sodax-scanner-mpc/mpc-flows-sample.json). Each is
// mapped from a real flow's legs into the DB `messages` row shape the scanner
// reads: leg `nearSubmit`/`submitMessage` -> attested_* (near, nid 15), `burn` ->
// hub_burn_* (146), `hubMint` -> mint_* (146), `sweep` -> sweep_* (dest spoke),
// `release` -> release_* (dest spoke). Completed flows carry status `executed`
// (swept/released are timeline legs, not status values).
//
// GATE-1 / RISK-1: mapped from real flow data but the column/status NAMES are
// still dev-asserted from the spec; sign off against a real DB row before merge.

// deposit, sweep chain (zcash 133), completed. Real flow
// 133-ff2865bca206…-swept. Terminal = swept.
export const depositSweepComplete = {
    id: 1,
    sn: null,
    status: 'executed',
    action_type: 'deposit',
    action_detail: 'Deposit',
    src_network: '133',
    src_tx_hash: 'ff2865bca206c57c180e401141d67f0d5eff3d190d843b41dbd04de61fbf5445',
    dest_network: '133',
    dest_tx_hash: 'ebaf073b4d43a79de77eea0bebf0902e0da012e3e78710781325c258aff9ebca',
    attested_network: '15',
    attested_tx_hash: 'GfWe2n7h535KR1v1wKqZHZcEnoKrhxriYqiAtY8PdKjC',
    hub_burn_network: null,
    hub_burn_tx_hash: null,
    mint_network: '146',
    mint_tx_hash: '0x14842d3d9dff4630ef8e03aff6c4b3e33235a9c694df32d8a6e1d34b6e4ae975',
    sweep_network: '133',
    sweep_tx_hash: 'ebaf073b4d43a79de77eea0bebf0902e0da012e3e78710781325c258aff9ebca',
    release_network: null,
    release_tx_hash: null,
    created_at: 1786532697,
    updated_at: 1786533000,
}

// deposit, memo chain (xrp 66), completed. Real flow 66-0xfe321453…-minted (no
// sweep leg). Terminal = minted.
export const depositMemoComplete = {
    id: 2,
    sn: null,
    status: 'executed',
    action_type: 'deposit',
    action_detail: 'Deposit',
    src_network: '66',
    src_tx_hash: '0xfe321453a14d53ce1c4554730bde2d3be245e1db0bdf01ef0ea6a6df5d9a6b02',
    dest_network: '66',
    dest_tx_hash: '0x09eb40d0020d9081a96836d5dbb4acadd81033b146cd95decdcf1bc5171f841e',
    attested_network: '15',
    attested_tx_hash: '5PafFiBnKSukh813Gkgyb4HDLgthmhsJA7KhVDbxfdCL',
    hub_burn_network: null,
    hub_burn_tx_hash: null,
    mint_network: '146',
    mint_tx_hash: '0x09eb40d0020d9081a96836d5dbb4acadd81033b146cd95decdcf1bc5171f841e',
    sweep_network: null,
    sweep_tx_hash: null,
    release_network: null,
    release_tx_hash: null,
    created_at: 1786600000,
    updated_at: 1786600300,
}

// withdrawal, completed. Real flow 146-0x1f8cd7a7…-released. Source on Sonic 146
// (a legacy chain — detection MUST come from dest 133). Terminal = released.
export const withdrawalReleased = {
    id: 3,
    sn: null,
    status: 'executed',
    action_type: 'withdrawal',
    action_detail: 'Withdraw',
    src_network: '146',
    src_tx_hash: '0x1f8cd7a7794629e45022057eb3d7bab0a32acb342ab09df78c4a528b15f24b26',
    dest_network: '133',
    dest_tx_hash: '6be3bdd4514f408a225d4ea980f1c0131dbf69c5dca79797f217ca3fb1c7ea9c',
    attested_network: '15',
    attested_tx_hash: '7TxQNCXtjs2mGRfKovSMKpEF9SdnfZhWu2qyDTGTzQ1J',
    hub_burn_network: '146',
    hub_burn_tx_hash: '0x1f8cd7a7794629e45022057eb3d7bab0a32acb342ab09df78c4a528b15f24b26',
    mint_network: null,
    mint_tx_hash: null,
    sweep_network: null,
    sweep_tx_hash: null,
    release_network: '133',
    release_tx_hash: '6be3bdd4514f408a225d4ea980f1c0131dbf69c5dca79797f217ca3fb1c7ea9c',
    created_at: 1786700000,
    updated_at: 1786700400,
}

// transfer, completed. Real flow 146-0x216e577a…-released (attested + release,
// release on monad 48). Source on Sonic 146; detection from dest 48. Terminal =
// released.
export const transferReleased = {
    id: 4,
    sn: null,
    status: 'executed',
    action_type: 'transfer',
    action_detail: 'Transfer',
    src_network: '146',
    src_tx_hash: '0x216e577afa6c8f0ce5c36f8b2cc4a36f2c10124566a4decbcb7c4490124d9365',
    dest_network: '48',
    dest_tx_hash: '0x48f53389ec7cfe40761618fa67640957cf989c289d0014601a1fd816ebca4756',
    attested_network: '15',
    attested_tx_hash: '7X8DruZbBg6Rg3nF85U1nn8p4RSaZ6VZ7nXjC4KwopVn',
    hub_burn_network: null,
    hub_burn_tx_hash: null,
    mint_network: null,
    mint_tx_hash: null,
    sweep_network: null,
    sweep_tx_hash: null,
    release_network: '48',
    release_tx_hash: '0x48f53389ec7cfe40761618fa67640957cf989c289d0014601a1fd816ebca4756',
    created_at: 1786800000,
    updated_at: 1786800200,
}

// in-progress: routed-stage deposit (no legs beyond source). Real flow
// 66-0xf9e933b6…-routed. `routed` is not a status → pre-attested = `pending` pill.
export const depositRouted = {
    id: 5,
    sn: null,
    status: 'pending',
    action_type: 'deposit',
    action_detail: 'Deposit',
    src_network: '66',
    src_tx_hash: '0xf9e933b6ff35e0a567bbe2e5352ff29021365ee001a33a0ab0f76165835588f7',
    dest_network: '66',
    dest_tx_hash: null,
    attested_network: null,
    attested_tx_hash: null,
    hub_burn_network: null,
    hub_burn_tx_hash: null,
    mint_network: null,
    mint_tx_hash: null,
    sweep_network: null,
    sweep_tx_hash: null,
    release_network: null,
    release_tx_hash: null,
    created_at: 1786532697,
    updated_at: null,
}

// in-progress: attested deposit (attested leg only). Real flow
// 133-f8279735…-attested. Pill = attested.
export const depositAttested = {
    id: 6,
    sn: null,
    status: 'attested',
    action_type: 'deposit',
    action_detail: 'Deposit',
    src_network: '133',
    src_tx_hash: 'f8279735303eed3dadbebfc3478fac890caba056ef6f7ddee964fbbd3fce842b',
    dest_network: '133',
    dest_tx_hash: null,
    attested_network: '15',
    attested_tx_hash: 'DRx9nw1cAcSdubrUWa37PEiWrMsZ3iZxqQNMmi4Erbzw',
    hub_burn_network: null,
    hub_burn_tx_hash: null,
    mint_network: null,
    mint_tx_hash: null,
    sweep_network: null,
    sweep_tx_hash: null,
    release_network: null,
    release_tx_hash: null,
    created_at: 1786810000,
    updated_at: null,
}

// in-progress: withdrawal past hub-burn (attested + burn, release pending). Real
// flow 146-0xe1d610f3…. `hub-burned` is not a status; a withdrawal has no
// `delivered` stage → in-progress pill = `attested`.
export const withdrawalHubBurned = {
    id: 7,
    sn: null,
    status: 'attested',
    action_type: 'withdrawal',
    action_detail: 'Withdraw',
    src_network: '146',
    src_tx_hash: '0xe1d610f394295e121af195f2998e118d9458561024cf2d982f592212dbed8999',
    dest_network: '133',
    dest_tx_hash: null,
    attested_network: '15',
    attested_tx_hash: 'He7zqfAZn8KZxEeFseQsgrafQ2gtxZ71FHzcirKu8nrL',
    hub_burn_network: '146',
    hub_burn_tx_hash: '0xe1d610f394295e121af195f2998e118d9458561024cf2d982f592212dbed8999',
    mint_network: null,
    mint_tx_hash: null,
    sweep_network: null,
    sweep_tx_hash: null,
    release_network: null,
    release_tx_hash: null,
    created_at: 1786820000,
    updated_at: null,
}

// in-progress: sweep-chain deposit minted, sweep pending. Derived from the
// swept-deposit flow with the sweep leg dropped (the sample had no naturally
// mint-only sweep-chain deposit). `minted` is not a status; sweep-mode post-mint
// pre-sweep = `delivered` pill; timeline shows Swept pending.
export const depositMintedPending = {
    id: 8,
    sn: null,
    status: 'delivered',
    action_type: 'deposit',
    action_detail: 'Deposit',
    src_network: '133',
    src_tx_hash: 'ff2865bca206c57c180e401141d67f0d5eff3d190d843b41dbd04de61fbf5445',
    dest_network: '133',
    dest_tx_hash: null,
    attested_network: '15',
    attested_tx_hash: 'GfWe2n7h535KR1v1wKqZHZcEnoKrhxriYqiAtY8PdKjC',
    hub_burn_network: null,
    hub_burn_tx_hash: null,
    mint_network: '146',
    mint_tx_hash: '0x14842d3d9dff4630ef8e03aff6c4b3e33235a9c694df32d8a6e1d34b6e4ae975',
    sweep_network: null,
    sweep_tx_hash: null,
    release_network: null,
    release_tx_hash: null,
    created_at: 1786830000,
    updated_at: null,
}

// Pre-existing non-MPC row: neither src (bsc 4) nor dest (avax 6) is an MPC chain.
export const legacyNonMpc = {
    id: 9,
    sn: 42,
    status: 'executed',
    action_type: 'transfer',
    action_detail: 'Transfer',
    src_network: '4',
    src_tx_hash: '0xsrc_legacy',
    dest_network: '6',
    dest_tx_hash: '0xdest_legacy',
    created_at: 1786840000,
    updated_at: 1786840100,
}
