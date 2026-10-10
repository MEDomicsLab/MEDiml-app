const learningMEDimlDefaultSettings = {
  // design
  design : {
    expName: "",
  },

  // split
  split : {
    path_outcome_file: "",
    path_ws_experiments: "",
    outcome_name: "",
    path_save_experiments: "",
    method: "all_learn",
    holdoutPercentage: 0.2, // "random" method only: proportion of the patients in the holdout set
    holdoutSeed: 1, // "random" method only: seed of the holdout set
    active_method: ["cv"],
    Random: {
      method: "SubSampling",
      nSplits: 10,
      stratifyInstitutions: true,
      testProportion: 0.33,
      seed: 54288
    },
    cv: {
      nFolds: 10,
      seed: 54288
    }
  },

  // data
  data : {
      nameType: "Radiomics",
      featuresFiles: []
  },

  // variables 
  radiomics_learner : {
    model: "xgboost", // PyCaret classification model ID, or "best" to auto-select with compare_models()
    bestInclude: [], // "best" only: models to compare (all models when empty)
    bestExclude: [], // "best" only: models to skip (ignored when bestInclude is set)
    nFeaturesToSelect: 0.3,
    optimizeThreshold: true,
    useGPU: true, // uses the GPU when available, as MEDiml's RadiomicsLearner
    nameSave: "xgboost_thresh_opt",
    optimizationMetric: "MCC",
    seed: 54288
  },
  //settings
  settings: {
    normalization: "combat",
    fSetReduction: "FDA",
    algorithm: "XGBoost"
  },

  // normalize
  normalization : {
    method: "combat",
  },

  //fsr
  feature_reduction : {
    method: "FDA",
    FDA: {
        nSplits: 100,
        corrType: "Spearman",
        threshStableStart: 0.5,
        threshInterCorr: 0.7,
        minNfeatStable: 100,
        minNfeatInterCorr: 60,
        minNfeat: 10,
        seed: 54288
    }
  },
  
  //cleaning
  cleaning : {
    default: {
      feature: {
        continuous: {
          missingCutoffps: 0.25,
          covCutoff: 0.1,
          missingCutoffpf: 0.1,
          imputation: "mean"
        }
      }
    }
  },
  analyze : {
    histogram: true,
    tree: false,
    heatmap: false,
    optimalLevel: false,
    histParams: {
      sortOption: "importance"
    },
    heatmapParams: {
      metric: "AUC_mean",
      extraMetrics: "Sensitivity_mean,Specificity_mean",
      pValues: true,
      pValuesMethod: "delong",
      title: ""
    }
  }
}

export default learningMEDimlDefaultSettings
