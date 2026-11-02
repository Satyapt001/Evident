# EVIDENT Model 1 source modules

Copy these four files into:

src/phishing/

Files:
- preprocessing.py
- feature_engineering.py
- inference.py
- predict.py

Install the additional runtime dependencies if they are not already present:

pip install requests beautifulsoup4

Important:
The implementation exposes the exact 50-feature model contract. Three PhiUSIIL-derived
features (URLSimilarityIndex, TLDLegitimateProb, URLCharProb) are runtime approximations
because the original reference distributions/formulas are not provided as a simple
deployment API. Do not present external validation metrics from this implementation as
a faithful reproduction of the original PhiUSIIL feature generator until those references
are reproduced.

The page fetch is enabled by default. Use this only in a controlled environment.
