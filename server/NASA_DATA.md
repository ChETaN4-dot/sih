# NASA PCoE Battery Model

The drift predictor can be trained from the NASA Prognostics Center of Excellence Battery Data Set:

`https://phm-datasets.s3.amazonaws.com/NASA/5.+Battery+Data+Set.zip`

Source citation: B. Saha and K. Goebel (2007), NASA Prognostics Data Repository.

The raw archive contains battery cycle records rather than the screening checkpoints used by this app. Convert selected same-parameter, same-unit cycles into a normalized CSV with this header:

```csv
parameter,unit,value_0h,value_24h,value_168h
Impedance,mOhm,10,12,18
```

Parse it with `parseNASATrainingCsv`, then pass the resulting rows as `nasaTrainingData` to `screening.evaluate`. The server fits an explainable ridge regression with features `Value_0h` and `Value_24h`, reports training MAE, and uses `nasa-pcoe-ridge-v1` in the screening result. Rows are filtered by parameter and unit so battery impedance data is never silently mixed with component leakage data.