<img src="MEDimlLogo.png" width="100" align="right" align="top" >
<br />

# MEDiml: MEDical Image analysis with Machine Learning | The application

MEDiml-app is a desktop application for extracting radiomics and dosiomics features from medical images without writing code. It provides a graphical user interface to the [MEDiml Python package](https://github.com/MEDomicsLab/MEDiml-pkg) and is part of the [MEDomics](https://github.com/MEDomicsLab/MEDomics) project.

## Statement of need

Radiomics turns medical images (CT, MR, PET, radiotherapy dose maps) into quantitative features that can feed predictive models of diagnosis, treatment response or outcome. Computing these features reproducibly is hard: the results depend on many preprocessing choices (voxel size, re-segmentation range, discretisation, filters), and the standardized tools that implement them, such as MEDiml, which follows the [Image Biomarker Standardisation Initiative (IBSI)](https://theibsi.github.io/), are programming libraries.

Many of the people who need radiomics features, such as clinicians, medical physicists and clinical researchers, do not program. MEDiml-app closes that gap. It lets them:

- convert DICOM or NIfTI datasets into MEDiml's format and check them before extraction;
- start from ready-to-use extraction settings, with in-app explanations of what each setting changes in the features;
- extract radiomics and dosiomics features for a whole dataset in one run;
- keep, with every result, the exact settings that produced it, so studies can be reported and repeated.

It also gives researchers who do program a fast way to prototype MEDiml settings before scripting them.

## Key features

- **Graphical user interface**: every MEDiml step, with no code to write.
- **Data processing and pre-checks**: DICOM and NIfTI conversion, plus voxel and intensity range checks across a dataset.
- **Batch extraction**: radiomics and dosiomics features for a whole dataset, with editable, validated settings.
- **Data analysis**: machine learning models for the extracted features.
- **Customizable workflows**: design and run workflows tailored to your study.

## Installation

Download the installer for your operating system from the [releases page](https://github.com/MEDomicsLab/MEDiml-app/releases) and follow the [Quick start guide](https://medomicslab.gitbook.io/mediml-app-docs/quick-start).

### Supported operating systems

| Operating system | Installer |
| --- | --- |
| Windows 10 or 11 (64-bit) | `.exe` |
| Ubuntu 22.04 or later (64-bit) | `.deb` |
| macOS (Apple silicon) | `.dmg` |

### Requirements

- A 64-bit operating system from the list above.
- An internet connection on first launch: the app downloads its own Python 3.9 environment (with MEDiml) into `~/.mediml/python`, and MongoDB. No Python installation is needed beforehand.

## Run from source

Prerequisites: [Git](https://git-scm.com/), [Node.js 18](https://nodejs.org/) and [Go 1.21 or later](https://go.dev/doc/install) (Go 1.24 or later on macOS).

```bash
git clone https://github.com/MEDomicsLab/MEDiml-app.git
cd MEDiml-app

# 1. JavaScript dependencies
npm install

# 2. Go server (rebuild it after any change to go_server/)
cd go_server
go build main.go
cd ..

# 3. Start the app in development mode
npm run dev
```

**Python environment:** on first launch, the setup dialog installs Python 3.9 and the packages listed in [`pythonEnv/requirements.txt`](pythonEnv/requirements.txt) (MEDiml included) into a `python/` folder in the repository, as well as MongoDB. If `~/.mediml/python` already exists, for example from an installed copy of the app, it is used instead.

To build the installers yourself, run `npm run build:win`, `npm run build:linux` or `npm run build:mac` on the matching operating system. The files are written to `build/dist/`.

## Documentation

- [MEDiml-app documentation](https://medomicslab.gitbook.io/mediml-app-docs), with the [Quick start](https://medomicslab.gitbook.io/mediml-app-docs/quick-start) and tutorials
- [MEDiml Python package](https://github.com/MEDomicsLab/MEDiml-pkg) and its [documentation](https://mediml.readthedocs.io)

## Getting help

- **Bugs and feature requests**: open an issue on [GitHub Issues](https://github.com/MEDomicsLab/MEDiml-app/issues).
- **Questions and discussion**: join the [MEDomics Discord](https://discord.gg/ZbaGj8E6mP).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MEDiml-app is released under the [GNU General Public License v3.0](LICENSE).
