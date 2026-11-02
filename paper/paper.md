---
title: "Medical Image Analysis with Machine Learning (MEDiml): Strategies for Simpler Radiomics"
tags:
  - Python
  - JavaScript
  - radiomics
  - medical imaging
  - machine learning
  - IBSI
  - oncology
authors:
  - given-names: Mahdi
    surname: Ait Lhaj Loutfi
    affiliation: 1
  - given-names: Simon
    surname: Provost
    affiliation: 1
  - given-names: Élodie
    surname: Gillard
    affiliation: 2
  - given-names: Moustafa Amine
    surname: Bezzahi
    affiliation: 2
  - given-names: Alexander
    surname: Chum
    affiliation: 1
  - given-names: Ben
    surname: Coull-Neveu
    affiliation: 1
  - given-names: Juan
    surname: Duran
    affiliation: 1
  - given-names: Mariem
    surname: Kallel
    affiliation: 2
  - given-names: Hakima
    surname: Laribi
    affiliation: 2
  - given-names: Oliver
    surname: Lefebvre
    affiliation: 2
  - given-names: Nicolas
    surname: Longchamps
    affiliation: 2
  - given-names: Thanh-Tri
    surname: Nguyen
    affiliation: 1
  - given-names: Steven
    surname: Ravary
    affiliation: 1
  - given-names: Ouael Nedjem Eddine
    surname: Sahbi
    affiliation: 2
  - given-names: Jérémy
    surname: Dana
    affiliation: 3
  - given-names: Martin
    surname: Vallières
    corresponding: true
    affiliation: "1, 2"
affiliations:
  - name: Medical Physics Unit, Department of Oncology, McGill University, Montréal, Canada
    index: 1
    ror: 01pxwe438
  - name: Department of Computer Science, Université de Sherbrooke, Sherbrooke, Canada
    index: 2
    ror: 00kybxq39
  - name: Department of Radiology, Centre de Recherche du Centre Hospitalier de l'Université de Montréal, Montréal, Canada
    index: 3
    ror: 0410a8y51
date: 30 October 2026
bibliography: paper.bib
---

# Summary

Medical images from computed tomography, magnetic resonance, and positron emission tomography contain far more information than a radiologist can extract with the naked eye. Radiomics extracts quantitative features describing shape, texture and intensity patterns within a region of interest (e.g., a tumor) that can then be used to develop machine learning models for predicting clinical outcomes [@lambin_radiomics_2012].

However, identifying the most predictive features for a given clinical problem remains a challenge, as large feature sets increase the risk of overfitting and reduce the interpretability of the model, particularly in small datasets [@issue_small_data_22]. Addressing these challenges often requires programming expertise and familiarity with machine learning methods, limiting the accessibility of radiomics for researchers without specialized technical backgrounds.

To improve the accessibility of radiomics, we present *MEDiml* ([www.mediml.app](https://www.mediml.app)), which stands for Medical Image Analysis with Machine Learning. *MEDiml* is an open-source software available both as a Python package (*MEDiml-pkg*) and as a desktop application (*MEDiml-app*). *MEDiml* covers the full radiomics workflow, including **image processing**, **feature extraction**, **model training** and **performance evaluation**.

*MEDiml* is built around complexity minimization [@loutfi_complexity_2024]. Features are grouped into complexity levels according to how much computation they require, from shape and size, to intensity, to texture, to features from filtered images. Simpler models are less prone to overfitting in small datasets, are more generalizable, and are easier for clinicians to interpret [@overf_radiomics]. For this purpose, *MEDiml* trains a model at each level and compares the levels with statistical tests, such that the simplest level with sufficient predictive performance is retained. Moreover, feature extraction in *MEDiml* follows international standards for radiomics extraction, set by the Image Biomarker Standardization Initiative (IBSI) guidelines [@ibsi_1; @ibsi_2], making feature extraction reproducible across studies.

Finally, clinical researchers without programming experience can design and execute radiomics experiments through a graphical interface, while other users can directly interact with the Python package or export interface-generated workflows as executable Python code.

# Statement of Need

Radiomics has a well-documented reproducibility problem, as feature values can shift substantially depending on image preprocessing choices, discretization parameters, and whether the software follows standardized definitions. A study by Zwanenburg *et al.* [@zwanenburg_assessing_2019] found that only a subset of radiomic features remained robust under image perturbations such as noise addition, rotation and contour variation. Although clear guidelines and standards now exist, the IBSI being the most significant, clinical translation remains poor [@how_to_7; @vulnerabilities_8].

The high dimensionality of radiomic feature sets is another significant challenge. Feature sets can exceed 10,000 values per scan, especially when image filters are applied [@radiomics_10k_6]. However, medical imaging datasets are rarely large enough to handle the required ratio of features to patients needed to prevent overfitting in specialized predictive modeling tasks [@issue_small_data_22]. Furthermore, the predictive value of radiomic features is highly dependent on the clinical context. For example, in lung cancer survival prediction, tumor volume alone has been shown to carry most of the prognostic signal, making texture features redundant [@vulnerabilities_8], whereas wavelet-transformed texture features were able to distinguish tissue subtypes in other applications [@depeursinge_lung_9].

Finally, the successful application of radiomics requires bridging the expertise of interdisciplinary teams: clinical researchers who understand the medical context, and computer scientists who can implement the analytical workflows. Nonetheless, tools designed primarily for one group may not meet the needs of the other.

# State of the Field

Several radiomics tools exist, ranging from open-source feature extraction libraries to graphical platforms. Their coverage of feature extraction, graphical interaction and predictive modeling varies, as does their reported coverage of the IBSI recommendations (see Table \ref{tab:comparison} for a comparison with *MEDiml*).

Table: **Comparison of *MEDiml* to Commonly Used Alternative Radiomics Extraction Tools.** GUI: graphical user interface. A '+' mark indicates that a capability is available; a '-' indicates that it is unavailable. "Partial" denotes incomplete compliance with the IBSI, and N/A means not applicable. \label{tab:comparison}

| **Package/Software** | **Type** | **Language** | **IBSI compliance** [@ibsi_1; @ibsi_2] | **Own radiomics engine** | **Machine learning integration** | **Local execution** | **Code generation** | **Open-source** |
|:-----------|:---------|:--------|:--------|:----|:----|:----|:----|:-----|
| PyRadiomics [@vangriethuysen_pyradiomics_2017] | Library | Python | Partial | + | - | + | N/A | + |
| 3D Slicer (SlicerRadiomics) [@fedorov_slicer_2012; @vangriethuysen_pyradiomics_2017] | GUI (Plugin) | Python | Via PyRadiomics | - | - | + | - | + |
| QuantImage v2 [@quantimage_v2] | GUI (web) | Python, JavaScript | Via PyRadiomics | - | + | - | - | + |
| MIRP [@zwanenburg_mirp_2024] | Library | Python | IBSI 1 & 2 | + | - | + | N/A | + |
| LIFEx [@nioche_lifex_2018] | GUI (Freeware) | Java | Partial | - | + | + | - | Free / Closed Source |
| CERR [@cerr_20] | Library and GUI | MATLAB | IBSI 1 & 2 | + | Partial | + | - | + |
| MITK [@wolf_mitk_2005] | Library and GUI (desktop app) | C++ | Partial | + | Partial | + | - | + |
| PySERA [@salmanpour_pysera_2026] | Library | Python | IBSI 1 & 2 | + | + | + | N/A | + |
| ***MEDiml*** [@loutfi_complexity_2024] | **Library and GUI (desktop app)** | **Python, JavaScript** | **IBSI 1 & 2** | + | + | + | + | + |

*MEDiml*'s specific contribution is the combination of IBSI compliance, a zero-code graphical interface, a Python package, integrated machine learning tools, and a code-generation feature that connects the graphical and programmatic options. In many of the reviewed tools, predictive modeling is either absent or limited to isolated functionalities, requiring users to export features to external software for feature selection, model development, or statistical analysis. Moreover, none of these tools connects graphical and programmatic interfaces through code generation.

# Software Design

![**Overview of the *MEDiml* Application and Python Package.** Block 1 shows the system design of both components and the code-generation feature that connects graphical workflows with Python code. Block 2 presents the analysis workflow, which starts with feature extraction from processed medical images, and continues with feature set reduction, model training, and results analysis. Block 3 shows the modules available through each component and the technologies on which they depend.\label{fig:workflow}](figures/Figure_Docs_MEDiml.png){ width=100% }

A key architectural characteristic of *MEDiml* is that the graphical interface and the Python package run on the same underlying computation, rather than being independent products, to ensure methodological consistency and reproducibility across components.

The default radiomic workflow in *MEDiml* includes the following steps: feature extraction, feature cleaning to remove constant, quasi-constant, and duplicate features, as well as feature normalization using ComBat [@combat] to mitigate non-biological batch effects arising from differences in scanner manufacturers, acquisition protocols, or reconstruction settings. Feature selection is then performed using the False Discovery Avoidance (FDA) approach [@fda_21] to identify the smallest subset of non-redundant predictive features associated to the clinical outcome. The selected features are subsequently used to train machine learning models using the *PyCaret* framework [@ali_pycaret_2024], with an integrated analysis mode that explains predictive decisions using individual feature importance driving the model's performance. This workflow is depicted in Figure \ref{fig:workflow}, Block 2.

![**A. The *MEDiml* Graphical Interface, Showing the Learning Module**. This module provides a visual workspace for configuring, conducting and analyzing machine learning experiments. **B. Example of a Generated Jupyter Notebook [@kluyver_jupyter_2016]**. The notebook is exported using the code generation feature and contains executable Python code corresponding to a graphically configured workflow.\label{fig:mediml_depiction}](figures/MEDiml_Interface_and_Code_Generation.png){ width=100% }

The *MEDiml* Python package (*MEDiml-pkg*) provides the computational framework used by both programmatic analyses and the graphical application. It is compliant with IBSI 1 and IBSI 2 [@ibsi_1; @ibsi_2], builds upon widely adopted scientific Python libraries, including *NumPy* [@harris_numpy_2020], *Pandas* [@pandas_2020] and *PyCaret* [@ali_pycaret_2024], and uses a modular architecture where each stage of the workflow is implemented as an independent component (Figure \ref{fig:workflow}, Block 3, provides a summary of the architecture):

- ***Wrangling***: This module covers data loading through the *DataManager* class, where all imaging scans are loaded, along with their corresponding masks, and prepared for subsequent processing. This module also provides users with statistics, including voxel intensity distribution analyses, to assist in the selection of the appropriate radiomic feature extraction parameters.
- ***Processing***: This module implements all methods required for data processing steps recommended by the IBSI, including interpolation, region of interest (ROI) extraction, re-segmentation, intensity discretization, and Standardized Uptake Value (SUV) computation for Positron Emission Tomography (PET) imaging, which are fundamental to radiomics analyses [@ibsi_1].
- ***Filters***: This optional module applies filtering techniques on images prior to feature extraction, to reduce noise, highlight anatomical structures, and generate new image representations, either using linear filters (mean, Laplacian-of-Gaussian, Laws, Gabor and wavelets) or nonlinear textural filters based on the gray-level co-occurrence matrix (GLCM) [@sebastian_glcm_2012], implemented in the *TexturalFilter* class. The latter are optimized to run on a Graphics Processing Unit (GPU) for computational efficiency [@buck_cuda_2007; @klockner_pycuda_2012].
- ***Biomarkers***: This core module performs the extraction of all IBSI-compliant radiomic feature families, from original or filtered images, for individual scans or entire cohorts through the *BatchExtractor* class. The *Ray* library [@moritz_ray_2018] is used to parallelize extraction tasks for faster computation.
- ***Learning***: This module encompasses the complete machine learning workflow. The *Feature Set Reduction (FSR)* class reduces the feature sets using the FDA method [@fda_21], and the *RadiomicsLearner* class trains and evaluates models across radiomic complexity levels, using any *PyCaret* algorithm with $k$-fold cross-validation [@arlot_cv_2010], random subsampling or bootstrapping. The *Results* class then compares complexity levels using statistical significance tests (*DeLong's* [@delong_1988; @delong_24], *Wilcoxon* [@wilcoxon_1945], *paired* [@student_ttest_1908] and *Nadeau-Bengio corrected t-tests* [@nadeau_bengio_2003]) and performance heatmaps, and interprets models through feature-importance histograms and Explanation Trees, which trace predictive contributions from the complexity level to filters, feature families and individual features. Finally, the optimal pipeline is retrained on the entire learning set, evaluated on a holdout set if provided, and exported for deployment.
- ***Utils***: This module contains general utility and shared components that support the operation of the other software modules.

The *MEDiml* desktop application (*MEDiml-app*) is a zero-code graphical interface in which every action invokes the same underlying Python package methods (Figure \ref{fig:mediml_depiction}A). The application is built using Electron [@electron], which packages a web-based interface as a native desktop application. Its drag-and-drop, node-based workflow editor is implemented using React Flow [@reactflow] (<https://reactflow.dev>), a package for constructing graph-based editors, and is organized around three hierarchical concepts. A **node** represents a specific processing step, such as data loading, feature cleaning, or model training, with configurable parameters and well-defined inputs and outputs. A **pipeline** is an ordered sequence of connected nodes, making the structure of the experiment explicit. A **scene** contains one or more pipelines that can be executed and compared simultaneously, and is the unit for saving, sharing and reproducing analyses.

The application exposes the package through four modules that follow the stages of a radiomics study:

- ***Single-Scan Extraction***: extracts features from an individual image and its mask to explore and validate processing and extraction settings.
- ***DataManager***: provides graphical access to the *DataManager* class to register a dataset and run exploratory analyses that guide the choice of extraction settings.
- ***BatchExtractor***: runs parallelized extraction across the full cohort, with settings configured per imaging modality, and produces a single feature table that can be split by feature family (morphological, intensity and texture) through its feature categorization step.
- ***Learning***: provides nodes for each stage of predictive modeling (Split, Design, Data, Cleaning, Normalization, Feature Reduction, Radiomics Learner and Analyze), allowing users to train, compare and interpret models across radiomic complexity levels, datasets or imaging modalities within the same scene.

The full *MEDiml* architecture is thoroughly explained in a published reference manual [@mediml_ref_manual].

## Code Generation

Since both interfaces rely on the same computational engine, graphical and programmatic workflows are functionally equivalent: a graphically configured **pipeline**, including its feature extraction settings, machine learning models and cross-validation parameters, is executed by the Python package (see Figure \ref{fig:workflow}, Block 1). Users can therefore export any **pipeline** directly from the interface as executable Python code in a Jupyter Notebook [@kluyver_jupyter_2016] format, with each **node** and its configuration converted into code (see Figure \ref{fig:mediml_depiction}B).

# Research Impact Statement

*MEDiml* has been applied in two radiomics studies [@loutfi_complexity_2024; @teodora], in which the software handled image processing, feature extraction, predictive modeling, and analyses of results. In the first study, *MEDiml* was applied to five cancer imaging datasets, totaling 2,104 scans; the software successfully identified, for each task, the simplest complexity level achieving optimal predictive performance, focusing on less complex models. The associated results are presented in Table \ref{tab:results}.

Table: ***MEDiml*'s Radiomics Analysis Results.** AUC: area under the receiver operating characteristic curve [@fawcett_roc_2006]; IDH1: isocitrate dehydrogenase 1; CECT: contrast-enhanced computed tomography; MRI: magnetic resonance imaging. \label{tab:results}

| **Cohort** | **Clinical Endpoint** | **AUC [Confidence Interval]** | **Sensitivity** | **Specificity** | **Optimal Feature Type** |
|:--------------|:--------------|:-----------|:------|:------|:-----------|
| Non-small cell lung cancer (NSCLC) | Histological subtype | 0.76 [0.71, 0.80] | 0.73 | 0.71 | Intensity features |
| Low-grade glioma | IDH1 mutation | 0.68 [0.60, 0.75] | 0.68 | 0.69 | Morphological features |
| Meningioma | Pathological tumor grade | 0.65 [0.59, 0.72] | 0.64 | 0.62 | Morphological features |
| Renal cell carcinoma (RCC) - CECT | Subtype discrimination | 0.82 [0.76, 0.88] | 0.77 | 0.78 | Intensity features |
| Renal cell carcinoma - MRI | Subtype discrimination | 0.72 [0.68, 0.77] | 0.71 | 0.65 | Texture features |

These studies demonstrated the utility of *MEDiml*'s complexity-minimization framework, emphasizing simpler and interpretable models. For example, in MRI-based RCC subtype classification, texture features were selected as the optimal complexity level (Figure \ref{fig:importance_tree}A), and the Explanation Tree traced their contribution down to individual features (Figure \ref{fig:importance_tree}B).

![**Complexity-level Analysis of Renal Cell Carcinoma (RCC) Subtype Classification (clear cell vs. papillary) From T2-weighted MRI.** **A.** Mean AUC, sensitivity (*Sens*) and specificity (*Spec*) across test folds for each complexity level, ordered from simplest (left) to most complex (right). Bottom rows show *Delong*'s p-values between levels: green, significant improvement (p < 0.05); red, no significant improvement. Textural features (T) were selected as the optimal level, as no more complex level performed significantly better. **B.** Explanation Tree of the selected model, tracing feature importance from the original (unfiltered) image to textural feature families and individual GLCM features. Line thickness reflects importance, dashed lines mark unselected features, and the orange path leads to the most important feature (GLCM cluster tendency).\label{fig:importance_tree}](figures/Heatmap_and_Importance_Tree.png){ width=100% }

*MEDiml* started as a tool primarily to support the core developer's own research, but it has since expanded to serve interdisciplinary teams. The package has been downloaded over 500 times from the Python Package Index (PyPI) to this date, reflecting a growing user base beyond its origins.

To support users, all information about the software is available on the official website: <https://mediml.app>. Overall, *MEDiml* provides the following set of resources:

1. **For the Python package:**
    a. Package: [PyPI](https://pypi.org/project/mediml/).
    b. Documentation: [ReadTheDocs](https://mediml.readthedocs.io/en/latest/).
    c. Tutorials: [Jupyter Notebooks](https://github.com/MEDomicsLab/MEDiml-pkg/tree/dev/notebooks).
    d. Source Code: [GitHub](https://github.com/MEDomicsLab/MEDiml-pkg).
2. **For the desktop application:**
    a. Application: [Download Page](https://www.mediml.app/#download).
    b. Documentation on [GitBook](https://medomicslab.gitbook.io/mediml-app-docs).
    c. Video tutorials: [YouTube](https://www.youtube.com/playlist?list=PLEPy2VhC4-D5Eg-UxRyTtmUZRh-D5m_Ru).
    d. Source Code: [GitHub](https://github.com/MEDomicsLab/MEDiml-app/).
3. **A community [Discord server](https://discord.gg/GjMW72fE9T).**

*MEDiml* is maintained and actively improved by the [MEDomicsLab research group](https://www.medomicslab.com) at McGill University.

# AI Usage Disclosure

Generative AI tools were used minimally during the development of *MEDiml-app* and *MEDiml-pkg*, mainly to help diagnose and fix difficult bugs and to suggest minor design improvements. All AI-suggested code was reviewed, tested and integrated by the developers, and the architecture, algorithms and methodological choices were designed by the authors. Claude Opus 5.5 (Anthropic) was used to convert the LaTeX version of this manuscript into the JOSS Markdown format. All AI-assisted content was reviewed, edited and validated by the authors, who take full responsibility for the software and this paper.

# Acknowledgments

We thank Guillaume Blain, Sarah Denis, and Andréanne Allaire for their valuable contributions to the development and enhancement of *MEDiml*'s user interface. We also thank Corentin Gauthier, Clarisse Cheng, and Anthonin Falk for their valuable contributions to the development of the *MEDiml* package. Finally, we gratefully acknowledge Martin Lepage for co-supervising a significant portion of this work [@loutfi_complexity_2024].

Martin Vallières acknowledges the support of Unité de soutien au Système de Santé Apprenant (SSA) Québec.

# References
