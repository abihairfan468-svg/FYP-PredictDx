# Training notebooks

Keep every Colab / Kaggle notebook here so the training work is visible to the examiners.

Suggested files:

- `01_dataset_build.ipynb` - build metadata.csv from the raw datasets, patient-level split
- `02_train_densenet121.ipynb` - two-phase transfer learning, class weights, callbacks
- `03_evaluate.ipynb` - confusion matrix, per-class recall, ROC-AUC on the held-out test set
- `04_gradcam.ipynb` - heatmaps reviewed against radiologist notes
- `05_risk_model.ipynb` - tabular risk model over clinical features

Export the trained model as `predictdx_densenet121_v1.keras` and place it in `../models/`.
Do not commit model files or datasets to Git.
