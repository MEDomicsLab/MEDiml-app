/* eslint-disable no-prototype-builtins */
import { Accordion, AccordionTab } from 'primereact/accordion'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Image } from 'primereact/image'
import { Message } from 'primereact/message'
import { Panel } from 'primereact/panel'
import { Splitter, SplitterPanel } from 'primereact/splitter'
import { useContext, useEffect, useRef, useState } from "react"
import { Col, Row } from "react-bootstrap"
import Card from "react-bootstrap/Card"
import { toast } from "react-toastify"
import Lightbox from "yet-another-react-lightbox"
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import "yet-another-react-lightbox/styles.css"
import { requestBackend } from "../../../utilities/requests"
import { ErrorRequestContext } from "../../generalPurpose/errorRequestContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import { EXPERIMENTS, WorkspaceContext } from "../../workspace/workspaceContext"
import { FlowFunctionsContext } from "../context/flowFunctionsContext"
import { FlowInfosContext } from "../context/flowInfosContext"
import { FlowResultsContext } from "../context/flowResultsContext"

/**
 * @param {string} pipelineKey key of a pipeline in the results (e.g. "pipeline2")
 * @param {Array} pipelines pipelines returned by the backend ({pipeline, id, path_study})
 * @returns {Object} the pipeline entry of the results key, it links the results to the scene's nodes
 */
const getPipelineEntry = (pipelineKey, pipelines) => {
  const pipelineId = parseInt(pipelineKey.replace("pipeline", ""))
  return pipelines.find((pipeline) => pipeline.id === pipelineId)
}

/**
 * @param {Object|string} error error returned by the backend
 * @returns {string} message to display to the user
 */
const getErrorMessage = (error) => {
  if (typeof error === "string") return error
  return error?.toast || error?.message || "Unknown error"
}

/**
 *
 * @returns {JSX.Element} A results pane accessed by using the menu tree
 *
 * @description
 * This component is used to display the results of the pipeline according to the selected nodes.
 *
 */
const ResultsPaneMEDiml = () => {
  const { selectedResultsId, setSelectedResultsId, flowResults, showResultsPane, setShowResultsPane, isResults } = useContext(FlowResultsContext)
  const [selectedResults, setSelectedResults] = useState([])
  const [selectedPipelines, setSelectedPipelines] = useState([])
  const [finalModels, setFinalModels] = useState({}) // final model of each finalized pipeline, by results key
  const [generatingPipeline, setGeneratingPipeline] = useState(null) // results key of the pipeline being generated
  const [finalizingPipeline, setFinalizingPipeline] = useState(null) // results key of the pipeline being finalized
  const { flowContent, sceneName } = useContext(FlowInfosContext)
  const { updateNode } = useContext(FlowFunctionsContext)
  const { pageId } = useContext(PageInfosContext)
  const { setError, setShowError } = useContext(ErrorRequestContext)
  const flowContentRef = useRef(flowContent) // latest scene, read when a request completes
  flowContentRef.current = flowContent
  const [expNames, setExpNames] = useState([])
  const [compareMode, setCompareMode] = useState(false)
  const [showMetrics, setShowMetrics] = useState(true)
  const [histogramImages, setHistogramImages] = useState([])
  const [heatMap, setHeatMap] = useState()
  const [treePlot, setTreePlot] = useState("")
  const [histogramsByPipeline, setHistogramsByPipeline] = useState({}) // histogram images of each pipeline, by results key
  const [lightboxSrc, setLightboxSrc] = useState(null) // image displayed in the zoomable lightbox
  const { getBasePath, port } = useContext(WorkspaceContext)

  /*
  * @Description: This function is used to get the path of a folder of the scene (e.g. "notebooks", "models")
  */
  const getScenePath = (folder) => {
    try {
      return [getBasePath(EXPERIMENTS), "LEARNING", sceneName, folder].join("/")
    } catch (error) {
      console.error("Error while getting the save path:", error)
      return null
    }
  }

  /*
  * @Description: This function is used to process the flow data
  */
  const processFlowData = (flowContent) => {
    try {
      // Initialize the new dictionnary for the modified flow
      let modifiedFlow = {
        drawflow: {
          Home: {
            data: {}
          }
        }
      }
      if (!flowContent || !flowContent.nodes) {
        throw new Error("Invalid flow content: missing nodes");
      }
      const newFlow = structuredClone(flowContent);
      newFlow.nodes.forEach((node) => {
        const nodeID = node.id.toString();
        modifiedFlow.drawflow.Home.data[nodeID] = {
          id: nodeID,
          name: node.data.internal.type.replaceAll(/ |-/g, "_"),
          data: node.data.internal.settings ? node.data.internal.settings : {},
          class: node.className,
          inputs: {},
          outputs: {}
        }
      });

      // Note : only the nodes in home module can be connected, therefore it is not necessary to check
      // if the edges to be in the structure other than Home in the dictionnary
      newFlow.edges.forEach((edge) => {
        const sourceNode = newFlow.nodes.find((node) => node.id === edge.source)
        const targetNode = newFlow.nodes.find((node) => node.id === edge.target)

        const sourceNodeID = sourceNode.id
        const targetNodeID = targetNode.id

        const outputKey = "output_1"
        const inputKey = "input_1"

        if (!modifiedFlow.drawflow.Home.data[sourceNodeID].outputs[outputKey]) {
          modifiedFlow.drawflow.Home.data[sourceNodeID].outputs[outputKey] = {
            connections: [{ node: targetNodeID, input: inputKey }]
          }
        } else {
          modifiedFlow.drawflow.Home.data[sourceNodeID].outputs[outputKey].connections.push({ node: targetNodeID, input: inputKey })
        }

        if (!modifiedFlow.drawflow.Home.data[targetNodeID].inputs[inputKey]) {
          modifiedFlow.drawflow.Home.data[targetNodeID].inputs[inputKey] = {
            connections: [{ node: sourceNodeID, output: outputKey }]
          }
        } else {
          modifiedFlow.drawflow.Home.data[targetNodeID].inputs[inputKey].connections.push({ node: sourceNodeID, output: outputKey })
        }
      })

      return modifiedFlow;
    }
    catch (error) {
      toast.error("Error detected while processing the flow data", error)
      console.error("Error detected while processing the flow data", error)
    }
  };

  /*
  * @Description: This function is used to generate the code of a pipeline
  * @param {string} pipelineKey results key of the pipeline (e.g. "pipeline1")
  * @param {Object} pipelineEntry pipeline entry of the results ({pipeline, id})
  * @param {string} expName experiment name of the pipeline
  */
  const generateCode = (pipelineKey, pipelineEntry, expName) => {
    if (!pipelineEntry){
      toast.error("No pipeline selected");
      return;
    } else {
      try {
        // Get notebook save path
        let notebookSavePath = getScenePath("notebooks")
        if (!notebookSavePath) {
          throw new Error("Notebook save path not found");
        }

        // Process data
        let newFlow = processFlowData(flowContent)
        if (!newFlow) return
        newFlow = {
          ...newFlow,
          "pipelines": [pipelineEntry],
          "pipeline_names": [expName],
          "save_path": notebookSavePath
        }

        // Loading state
        setGeneratingPipeline(pipelineKey)
        console.log("newFlow sent to backend", newFlow)
        requestBackend(
          port,
          "/learning_MEDiml/run_all/generate_pips",
          newFlow,
          (response) => {
            console.log("received results:", response)
            setGeneratingPipeline(null)
            if (!response.error) {
              console.log("Success response", response)
              toast.success("Notebook(s) generated successfully")

              // Open the notebook
              try{
                var pathNotebook = response.path_notebook;
                var portNotebook = port + 1;
                var exec = require('child_process').exec;
                exec(`jupyter notebook --port=${portNotebook} ${pathNotebook}`,
                    function (error, stdout, stderr) {
                        console.log('stdout: ' + stdout);
                        console.error('stderr: ' + stderr);
                        if (error !== null) {
                            console.error('exec error: ' + error);
                        }
                    });
                  }
              catch (error) {
                console.error("Error detected while opening the notebook", error)
              }
              
            } else {
              toast.error(response.error)
              console.error("error", response.error)
            }
            },
            (error) => {
              setGeneratingPipeline(null)
              toast.error("Error detected while running the experiment", error)
          }
        )
      } catch (error) {
        setGeneratingPipeline(null)
        toast.error("Error detected while generating the code", error)
        console.error("Error detected while generating the code", error)
      }
    }
  }

  /*
  * @Description: Stores the final model of a pipeline in the results of the Analyze node, so it is saved with the scene
  */
  const storeFinalModel = (pipelineKey, finalModel) => {
    const analyzeNode = flowContentRef.current?.nodes?.find((node) => node.type === "Analyze")
    if (!analyzeNode) return
    const results = analyzeNode.data.internal.results || {}
    updateNode({
      id: analyzeNode.id,
      updatedData: {
        ...analyzeNode.data.internal,
        results: {
          ...results,
          final_models: { ...(results.final_models || {}), [pipelineKey]: finalModel }
        }
      }
    })
  }

  /*
  * @Description: Resends the run_all request of the scene to train the final model of a pipeline
  * on the whole learning set, and evaluate it on the holdout set
  * @param {string} pipelineKey results key of the pipeline (e.g. "pipeline1")
  * @param {Object} pipelineEntry pipeline entry of the results ({pipeline, id, path_study})
  */
  const finalizeModel = (pipelineKey, pipelineEntry) => {
    try {
      const modelsPath = getScenePath("models")
      if (!modelsPath) {
        throw new Error("Models save path not found")
      }
      const newFlow = processFlowData(flowContent)
      if (!newFlow) return

      setFinalizingPipeline(pipelineKey)
      requestBackend(
        port,
        "/learning_MEDiml/run_all/" + pageId,
        {
          ...newFlow,
          finalize_model: true,
          pipeline: pipelineEntry.pipeline,
          path_study: pipelineEntry.path_study,
          models_path: modelsPath
        },
        (response) => {
          setFinalizingPipeline(null)
          if (!response.error) {
            storeFinalModel(pipelineKey, response.final_model)
            toast.success(`Final model of pipeline ${pipelineEntry.id} trained successfully`)
          } else {
            toast.error(getErrorMessage(response.error))
            console.error("error", response.error)
            setError(response.error)
            setShowError(true)
          }
        },
        (error) => {
          setFinalizingPipeline(null)
          toast.error("Error detected while finalizing the model", error)
          console.error("Error detected while finalizing the model", error)
        }
      )
    } catch (error) {
      setFinalizingPipeline(null)
      toast.error("Error detected while finalizing the model", error)
      console.error("Error detected while finalizing the model", error)
    }
  }

  /*
  * @Description: This function is used to render the actions of a pipeline (code generation, model finalization)
  */
  const renderPipelineActions = (pipelineKey, pipelineEntry, expName) => {
    const isBusy = generatingPipeline !== null || finalizingPipeline !== null
    const header = pipelineEntry ? `Pipeline ${pipelineEntry.id}: ${expName}` : expName
    let finalizeTooltip = "Retrain a final model on the whole learning set and evaluate it on the holdout set"
    if (!pipelineEntry?.path_study) {
      finalizeTooltip = "Run the experiment again to enable the model finalization"
    }
    // Buttons on the left, title on the right. Clicks on the buttons must not toggle the accordion.
    return (
      <div className="d-flex flex-grow-1 justify-content-between align-items-center gap-2">
        <div className="fw-bold">{header}</div>
        <div className="d-flex gap-2 text-end">
          <Button
            label="Generate"
            severity="secondary"
            size="small"
            rounded
            raised
            icon="pi pi-code"
            onClick={(event) => {
              event.stopPropagation()
              generateCode(pipelineKey, pipelineEntry, expName)
            }}
            disabled={!isResults || !pipelineEntry || isBusy}
            loading={generatingPipeline === pipelineKey}
          />
          <Button
            label="Finalize Model"
            severity="info"
            size="small"
            rounded
            raised
            icon="pi pi-check-circle"
            onClick={(event) => {
              event.stopPropagation()
              finalizeModel(pipelineKey, pipelineEntry)
            }}
            disabled={!isResults || !pipelineEntry?.path_study || isBusy}
            loading={finalizingPipeline === pipelineKey}
            tooltip={finalizeTooltip}
            tooltipOptions={{ position: "bottom", showOnDisabled: true }}
          />
        </div>
      </div>
    )
  }

  /*
  * @Description: This function is used to render the final model of a pipeline (paths and holdout metrics)
  */
  const renderFinalModel = (finalModel, pipelineKey) => {
    const holdout = finalModel.holdout
    // Only simple values can be displayed in the table
    const metricsKeys = holdout ? Object.keys(holdout).filter((key) => holdout[key] === null || typeof holdout[key] !== "object") : []
    return (
      <Accordion key={`AccordionTab-FinalModel-${pipelineKey}`}>
        <AccordionTab disabled={!isResults} header={"Final Model"}>
          <div className="text-start mb-2">
            <div><b>Model:</b> {finalModel.model_copy_path || finalModel.model_path}</div>
            {finalModel.model_copy_path && (<div><b>Study copy:</b> {finalModel.model_path}</div>)}
            <div><b>Patients:</b> {finalModel.n_train} in the learning set, {finalModel.n_holdout} in the holdout set</div>
          </div>
          {metricsKeys.length > 0 ? (
            <DataTable value={[holdout]}>
              {metricsKeys.map((key, columnIndex) => (
                <Column key={key} field={key} header={key} style={columnIndex % 2 !== 0 && { backgroundColor: 'lightblue' }}/>
              ))}
            </DataTable>
          ) : (
            <Message severity="info" text="No holdout set available: the final model was trained on the whole learning set without holdout evaluation."/>
          )}
        </AccordionTab>
      </Accordion>
    )
  }

  /*
  * @Description: This function is used to render the results in a table (experiment by experiment)
  */
  const renderAccordions = (data, isResults) => {
    // if data is empty, display a warning
    if (!data || data.length === 0) {
      return (
        <Accordion>
          <AccordionTab key={`AccordionTab-${0}`} header={"No results to display"}>
            <div style={{ color: 'red' }}>Warning: Values are empty or undefined.</div>
          </AccordionTab>
        </Accordion>
      );
    }

    // Else
    try {    
      return data.map((pipelines, indexPip) => {
        return (
              Object.entries(pipelines).map((item, index) => {
                // item[0] is the results key of the pipeline (e.g. "pipeline2"), linked to the scene by its pipeline entry
                const pipelineKey = item[0]
                const pipelineEntry = getPipelineEntry(pipelineKey, selectedPipelines)
                const expName = Object.keys(item[1]).find((key) => key !== "analysis")
                return (
                  <Accordion key={`Accordion-${index+indexPip}`}>
                    <AccordionTab disabled={!isResults} key={`AccordionTab-${index+indexPip}`} headerTemplate={renderPipelineActions(pipelineKey, pipelineEntry, expName)}>
                      
                      {renderAccordionTabs(item[1], index, isResults)}

                      {/*Final model*/}
                      {finalModels[pipelineKey] && renderFinalModel(finalModels[pipelineKey], pipelineKey)}

                      {/*Histograms*/}
                      {(histogramsByPipeline[pipelineKey]?.length > 0) && <Accordion key={`AccordionTab-Histograms-${index+indexPip}`}>
                        <AccordionTab disabled={!isResults} key={`AccordionTab-Figures-${index+indexPip}`} header={"Analysis Plots"}>
                          {histogramsByPipeline[pipelineKey].map((src, imageIndex) => (
                            <img
                              key={imageIndex}
                              src={src}
                              alt="Features importance histogram"
                              title="Click to zoom"
                              style={{ maxWidth: "100%", cursor: "zoom-in" }}
                              onClick={() => setLightboxSrc(src)}
                            />
                          ))}
                        </AccordionTab>
                      </Accordion>}
                    </AccordionTab>
                  </Accordion>
                );
              })
            
      )});
    } catch (error) {
      toast.error("Invalid workflow", error)
    }
  };
  
  const renderAccordionTabs = (item, index, isResults) => {
    return Object.keys(item).map((currentExp, _) => {
      if (expNames.includes(currentExp)){
        return Object.keys(item[currentExp]).map((key, dataIdx) => {
          let values = item[currentExp][key];

          let keysList = Object.keys(values);

          // Add experiment name to the list of keys
          if (expNames.length > 0) {
            if (!values.hasOwnProperty("Experiment")) {
              values["Experiment"] = currentExp;
            }
            if (keysList.includes("Experiment")){
              keysList.splice(keysList.indexOf("Experiment"), 1);
            }
            keysList.unshift("Experiment");
          }

          // If no metrics are found, display a warning
          if (!values || keysList.length === 0 || (expNames.length > 0 && keysList.length === 1)){
            return (
              <Accordion key={key}>
                <AccordionTab key={`AccordionTab-${index}-${dataIdx}`} header={key}>
                  <div style={{ color: 'red' }}>Warning: Values are empty or undefined.</div>
                </AccordionTab>
              </Accordion>
            );
          }
          
          // Display the metrics in a table
          return (
            <Accordion key={key}>
              <AccordionTab disabled={!isResults} key={`AccordionTab-${dataIdx+index+1}`} header={key}>
                <DataTable value={[values]}>
                  {keysList.map((key1, columnIndex) => (
                    <Column key={key1} field={key1} header={key1} style={columnIndex % 2 !== 0 && { backgroundColor: 'lightblue' }}/>
                  ))}
                </DataTable>
              </AccordionTab>
            </Accordion>
          );
        });
      }
    });
  };

  /*
  * @Description: This function is used to render the results in a table in compare mode
  */
  const renderAccordionCompared = (data, isResults) => {

    try {
      // if data is empty, display a warning
      if (!data || data.length === 0) {
        return (
          <Accordion>
            <AccordionTab key={`AccordionTab-${0}`} header={"No results to display"}>
              <div style={{ color: 'red' }}>Warning: Values are empty or undefined.</div>
            </AccordionTab>
          </Accordion>
        );
      }
      let values = [[]]
      let MetricsKeysList = []
      let keysList = []

      // Find unique keys in both experiments
      for (let index = 0; index < data.length; index++) {
        let item = data[index];
        // loop through item
        Object.keys(item).map((key, _) => {
          if (Object.keys(item[key]).length > 1){
            Object.keys(item[key]).map((key1, _) => {
              if (expNames.includes(key1)){
                keysList.push(Object.keys(item[key][key1]));
              }
            });
          }
        });
        //keysList.push(Object.keys(item[expNames[index]]));
      }
      keysList = keysList.reduce((a, b) => a.filter(c => b.includes(c)));

      // Fill values for Data Table
      let keyIndex = 0;
      for (const key of keysList) {
        values[keyIndex] = []
        for (let index = 0; index < data.length; index++) {
            let item = data[index];
            // loop through item
            Object.keys(item).map((key1, _) => {
              if (Object.keys(item[key1]).length > 1){
                Object.keys(item[key1]).map((key2, _) => {
                  if (expNames.includes(key2)){
                    let currectKeys = Object.keys(item[key1][key2][key]);

                    if (currectKeys.length > 1){
                      values[keyIndex][index] = item[key1][key2][key];
                      MetricsKeysList = Object.keys(item[key1][key2][key]);

                      // Add experiment name to the list of keys
                      if (!values.hasOwnProperty("Experiment")) {
                        values[keyIndex][index]["Experiment"] = key1 + "_" + key2;
                      }
                      if (MetricsKeysList.includes("Experiment")){
                        MetricsKeysList.splice(MetricsKeysList.indexOf("Experiment"), 1);
                      }
                      MetricsKeysList.unshift("Experiment");
                    }
                  }
                });
              }
            });
          }

          /*const item = data[index];
          if (Object.keys(item[expNames[index]][key]).length > 1){
            values[keyIndex][index] = item[expNames[index]][key];
            MetricsKeysList = Object.keys(item[expNames[index]][key]);*/
        
        keyIndex++;
      }

      // If no metrics are found, display a warning
      if (!values || MetricsKeysList.length === 0 || (expNames.length > 0 && MetricsKeysList.length === 1)) {
        return keysList.map((item, key) => {
          <Accordion key={`Accordion-${key}`}>
            <AccordionTab key={`AccordionTab-${key}`} header={item}>
              <div style={{ color: 'red' }}>Warning: Values are empty or undefined.</div>
            </AccordionTab>
          </Accordion>
        });
      }
      
      // Display the metrics in a table
      return <>
      {(showMetrics) && (<Card className="text-center">
        <Card.Title>Metrics</Card.Title>
        {keysList.map((item, key) => {
          return (
          <Accordion key={`Accordion-${key}`}>
            <AccordionTab disabled={!isResults} key={`AccordionTab-${key}`} header={item}>
                <DataTable value={values[key]} stripedRows>
                  {MetricsKeysList.map((key1, columnIndex) => (
                    <Column key={key1} field={key1} header={key1}/>
                  ))}
                </DataTable>
            </AccordionTab>
          </Accordion>
          );
        })}
      </Card>)}

      {/*Figures*/}
      <Card className="text-center">
        <Card.Title>Plots</Card.Title>
          <Accordion>
            <AccordionTab disabled={!isResults} key={`AccordionTab-Figures`} header={"Compare Analysis Plots"}>
              {histogramImages.length > 0 ? 
                (<Panel header="Feature Importance" toggleable>
                    <Splitter >
                      {histogramImages.map((image, index) => (
                        <SplitterPanel key={index}>
                          <Image key={index} src={histogramImages[index]} alt="Image" width="300" preview/>
                        </SplitterPanel>
                      ))}
                    </Splitter>
                </Panel>) : (
                <Panel header="Tree Plot" toggleable>
                  <div style={{ color: 'red' }}>No feature importance histogram generated.</div>
                </Panel>
              )}
                      
              {(heatMap === undefined || heatMap === "") && (
                <Panel header="Heatmap" toggleable>
                  <div style={{ color: 'red' }}>No heatmap generated.</div>
                </Panel>
              )}
              {(treePlot === undefined || treePlot === "") && (
                <Panel header="Tree Plot" toggleable>
                  <div style={{ color: 'red' }}>No tree plot generated.</div>
                </Panel>
              )}
              {(heatMap !== undefined && heatMap !== "") && (
                <Panel header="Heatmap" toggleable>
                  <Image key={"Heatmap"} src={heatMap} alt="Image" width="500" preview/>
                </Panel>
              )}
              {(treePlot !== undefined && treePlot !== "") && (
                <Panel header="Tree Plot" toggleable>
                  <Image key={"treePlot"} src={treePlot} alt="Image" width="500" preview/>
                </Panel>
              )}
            </AccordionTab>
        </Accordion>
      </Card>
    </>
    } catch (error) {
      toast.error("Invalid workflow for compare mode", error)
      return (
        <Accordion>
          <AccordionTab key={`AccordionTab-${0}`} header={"Error occured, no results to display"}>
            <div style={{ color: 'red' }}>Warning: Values are empty or undefined.</div>
          </AccordionTab>
        </Accordion>
      );
    }
  };

  const handleClose = () => setShowResultsPane(false)

  useEffect(() => {
    if (flowContent.nodes) {
      const nativeImage = require("electron").nativeImage
      let histograms = []
      let histogramsPerPipeline = {}
      flowContent.nodes.map((node) => {
        if (node.type === "Analyze"){
          // Images
          if (node.data.internal.results.hasOwnProperty("figures")){
            // Heatmap
            if (node.data.internal.results.figures.hasOwnProperty("heatmap")){
              if (node.data.internal.results.figures.hasOwnProperty("heatmap")){
                if (node.data.internal.results.figures.heatmap.hasOwnProperty("path")){
                    const image = nativeImage.createFromPath(node.data.internal.results.figures.heatmap.path)
                    const url = image.toDataURL()
                    setHeatMap(url)
                }
              }
            }
            // Tree Plot
            if (node.data.internal.results.figures.hasOwnProperty("treeplot")){
              if (node.data.internal.results.figures.hasOwnProperty("treeplot")){
                if (node.data.internal.results.figures.treeplot.hasOwnProperty("treeplot")){
                    setTreePlot(node.data.internal.results.figures.treeplot.path)
                }
              }
            }
          }
          // Results - Metrics
          if (node.data.internal.results.hasOwnProperty("results_avg")){
            setSelectedResults(node.data.internal.results.results_avg)
            // Histograms
            try{
              const loadedPaths = []
              for (let index = 0; index < node.data.internal.results.results_avg.length; index++) {
                Object.entries(node.data.internal.results.results_avg[index]).map((item, _) => {
                  // item[0] is the results key of the pipeline (e.g. "pipeline2")
                  const pipelineHistograms = []
                  Object.entries(item[1]).map((itemAnalysis, _) => {
                    Object.entries(itemAnalysis[1]).map((resultAnalysis, _) => {
                      let result = resultAnalysis[1];
                          if (result && result.hasOwnProperty("histogram")){
                            if (result.histogram.hasOwnProperty("path")){
                              const url = nativeImage.createFromPath(result.histogram.path).toDataURL()
                              pipelineHistograms.push(url)
                              if(!loadedPaths.includes(result.histogram.path)){
                                loadedPaths.push(result.histogram.path)
                                histograms.push(url)
                              }
                            }
                          }
                        })
                  });
                  histogramsPerPipeline[item[0]] = pipelineHistograms
                });
              }
            } catch (error) {
              console.error("Error detected while processing histograms", error)
            }
          }
          if (node.data.internal.results.hasOwnProperty("pipelines")){
            setSelectedPipelines(node.data.internal.results.pipelines)
          }
          setFinalModels(node.data.internal.results.final_models || {})
          if (node.data.internal.results.hasOwnProperty("experiments")){
            setExpNames(node.data.internal.results.experiments)
          }
        }
      })
      if (histograms.length > 0) {
        setHistogramImages(histograms)
      }
      setHistogramsByPipeline(histogramsPerPipeline)
    }
  }, [flowContent])

  return (
    <>
      <Col className=" padding-0 results-Panel">
        <Card>
          <Card.Header className="flex-wrap justify-content-center">
            <div className="d-flex justify-content-between align-items-center">
              <h5>Results</h5>
              {/*Button to compare*/}
              <Button
                label={compareMode? ("Compare Mode: ON") : ("Compare Mode: OFF")}
                severity={compareMode? ("success") : ("danger")}
                size="small"
                rounded
                raised
                icon="pi pi-power-off"
                onClick={() => setCompareMode(!compareMode)}
              />
              <Button icon="pi pi-times" rounded text raised severity="danger" aria-label="Cancel" onClick={handleClose}/>
            </div>
          </Card.Header>
          <Card.Body>
            {/*Button to toggle metrics*/}
            {(compareMode) && (
              <Row className="form-group-box justify-content-center">
                <Button
                  label={showMetrics?  ("Hide Metrics") : ("Show Metrics")}
                  severity={showMetrics? ("info") : ("success")}
                  rounded
                  raised
                  icon={showMetrics? ("pi pi-eye-slash") : ("pi pi-eye")}
                  onClick={() => setShowMetrics(!showMetrics)}
                  style={{ width: 'fit-content', margin: 'auto' }}
                />
              </Row>
            )}
            {compareMode ? (renderAccordionCompared(selectedResults, isResults)) : (renderAccordions(selectedResults, isResults))}
            {/*Zoomable view of the clicked analysis plot*/}
            <Lightbox
              open={lightboxSrc !== null}
              plugins={[Zoom, Fullscreen]}
              close={() => setLightboxSrc(null)}
              slides={lightboxSrc ? [{ src: lightboxSrc }] : []}
              carousel={{ finite: true }}
            />
          </Card.Body>
        </Card>
      </Col>
    </>
  )
}

export default ResultsPaneMEDiml
