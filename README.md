# crossweave

A Java-first synthetic correlation lab. Move a trailing window through six invented signals, inspect an annotated Pearson correlation matrix, open a pair's scatter plot, and trace its correlation across overlapping windows.

## Explore

- Three generators: a follower that changes sign after observation 120, steady relationships, and a flat sixth signal.
- Window lengths 40, 80 or 120 within 240 observations. The applied end is inclusive, from the window length through 240.
- Select a matrix cell or either pair selector. Both axes, the current matrix and the selected rolling point use the same observations.
- Compare current r with the first window of the same length. Their difference is in unitless correlation points, not a percentage.
- Constant signals have undefined correlation, including on the diagonal. NA is never colored or treated as zero.
- Signal E is a noisy square of A: a small linear correlation need not mean no relationship.

All signals are unitless and invented, not returns or forecasts. This is not a market-data terminal, an as-of backtest, an inference tool or investment advice. The rolling chart deliberately shows the entire generated history, including windows after the selected end. No significance tests, confidence intervals, missing observations, real accounts or actual trading are modeled.

## Run

Java 21+, Node 22+, Chrome for browser checks. Python 3.12 and test-only NumPy/SciPy are optional independent references.

```sh
javac -d build/classes src/crossweave/*.java tools/*.java tests/crossweave/*.java
java -cp build/classes crossweave.TestRunner
node tests/parity.mjs
node tests/domain.mjs
node tools/build-web.mjs
node tests/browser-smoke.mjs
python3 -m pip install --only-binary=:all: numpy==2.2.6 scipy==1.15.3
python3 tests/reference.py
python3 -m http.server 8000 --directory docs
```

Open the printed local URL. Browser code needs no packages or build-time service. Nothing is uploaded, saved to browser storage or requested from an external origin at runtime. The Java engine is in `src/crossweave/`; its browser port is in `web/src/`. `docs/` is the exact four-asset deployment copy. See [NUMERICS.md](NUMERICS.md) for the model, formulae and limits.

## License

Original code and documentation are **MIT OR Apache-2.0**, at your choice. See [LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE). No third-party data, fonts, code, images or papers are bundled. Linked references remain their authors' work.
