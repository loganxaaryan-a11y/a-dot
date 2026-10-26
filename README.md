# A Dot

A standalone canvas game: Maze, Field, Door, Orbit, Ravens, Memory, Tracking, and Return.

Open `index.html` in a browser. No runtime dependencies or backend are required.

## Verify changes

Run `node --test tests/game.test.cjs` with Node.js 22 or later. The checks reject incomplete HTML or missing game scripts, exercise the built-in game simulations, and cover hint timing, skip attribution, replay resets, missing evidence, and report export.

These are logic tests with a simulated DOM/canvas. They do not replace a browser playthrough. Check pointer interactions, rendering, the report, and phone layouts in a real browser before publishing.

The page has existing development shortcuts: Ctrl+Alt+H shows a hint scenario, Ctrl+Alt+O opens Orbit, Ctrl+Alt+M opens Return, Ctrl+Alt+R opens a synthetic report, and Ctrl+Alt+S shows the Maze skip offer. These scenarios contain synthetic or missing evidence; do not interpret their reports as player results.

## Publishing safely

Deploy the complete `index.html`, not manually retyped or model-generated chunks. Verify the Git blob hash against the local file before advancing `main`, then verify the published response. A successful Pages deployment alone does not prove the game is complete or functional.

The October 26 recovery restored the original complete game in commit `1f0080c07916f6f56351458524f6a193a6ec0099` before repairing the enhancement.

## Report interpretation

The seven dimensions are informal summaries of this run, not psychometric scores or diagnoses. Missing evidence stays unscored. An action recorded after a hint does not prove that the hint was read, understood, or responsible for success.
