import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { useState } from 'react';
import { Form, Row } from "react-bootstrap";
import Node from "../../flow/node";
import Caption from '../../primitives/Caption'
import { sectionCardClass } from '../../primitives/SectionCard'


/**
 * @param {string} id id of the node
 * @param {object} data data of the node
 * @param {string} type type of the node
 * @returns {JSX.Element} A SegmentationNode node
 *
 * @description
 * This component is used to display a SegmentationNode node.
 * it handles the display of the node and the modal
 */
const Analyze = ({ id, data, type }) => {

  const [reload, setReload] = useState(false);
  const sectionStyle = {
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
  }
  const lastSectionStyle = { marginBottom: "16px" }

  return (
    <>
      <Node
        key={id}
        id={id}
        data={data}
        type={type}
        setupParam={data.setupParam}
        nodeSpecific={
          <>
            {/* Show segmentation warning when there is no roisList or the roisList is empty */}
            {
              <Row 
                className={sectionCardClass} 
                style={{ maxHeight: "400px", overflowY: "auto", overflowX: "hidden", paddingRight: "8px" }}
              >
              <Row className={sectionCardClass}>
                {/* Analyze methods */}
                <Form.Group controlId="analysisMeth" style={sectionStyle}>
                  <Form.Label className="analysisMeth">Analysis Methods</Form.Label>
                  <Caption>Select visualization techniques for analysis.</Caption>
                    <div key={"HistogramMeth"} style={{display: 'flex', justifyContent:'flex-start'}}>
                      <Checkbox
                        onChange={(event) => {
                          // check if the file is already in the list if yes remove it
                          if (data.internal.settings.histogram) {
                            data.internal.settings.histogram = false;
                          } else {
                            data.internal.settings.histogram = true;
                          }
                          setReload(!reload);
                        }}
                        checked={data.internal.settings.histogram}
                      />
                      <label htmlFor={"HistogramMeth"} className="ml-2">Histogram</label>
                    </div>
                    <div key={"HeatMapMeth"} style={{display: 'flex', justifyContent:'flex-start'}}>
                      <Checkbox
                        onChange={(event) => {
                          // check if the file is already in the list if yes remove it
                          if (data.internal.settings.heatmap) {
                            data.internal.settings.heatmap = false;
                          } else {
                            data.internal.settings.heatmap = true;
                          }
                          setReload(!reload);
                        }}
                        checked={data.internal.settings.heatmap}
                      />
                      <label htmlFor={"HeatMapMeth"} className="ml-2">Heatmap</label>
                    </div>
                    <div key={"ImpTreeMeth"} style={{display: 'flex', justifyContent:'flex-start'}}>
                      <Checkbox
                        onChange={(event) => {
                          // check if the file is already in the list if yes remove it
                          if (data.internal.settings.tree) {
                            data.internal.settings.tree = false;
                          } else {
                            data.internal.settings.tree = true;
                          }
                          setReload(!reload);
                        }}
                        checked={data.internal.settings.tree}
                      />
                      <label htmlFor={"ImpTreeMeth"} className="ml-2">Importance Tree</label>
                    </div>
                </Form.Group>

                {/* P-value yes or no */}
                <Form.Group controlId="findOptimalLvl" style={lastSectionStyle}>
                  <Form.Label className="findOptimalLvl">Find Optimal Level</Form.Label>
                  <Caption>Automatically determine optimal classification threshold.</Caption>
                  <InputSwitch 
                    checked={data.internal.settings.optimalLevel}
                    onChange={(event) => {
                        data.setupParam.possibleSettings.defaultSettings.optimalLevel = event.target.value;
                        data.internal.settings.optimalLevel = event.target.value;
                        setReload(!reload);
                    }}
                  />
                </Form.Group>
              </Row>
                
              {/*Histogram method parameters*/}
              {(data.internal.settings.histogram) && (
                <Row className={sectionCardClass}>
                  <Form.Group controlId="histPlotParams" style={lastSectionStyle}>
                    <Form.Label className="histPlotParams">Histogram Sort Option</Form.Label>
                    <Caption>Sort features by importance or frequency.</Caption>
                    <Dropdown 
                      style={{width: "200px"}}
                      value={data.setupParam.possibleSettings.defaultSettings.histParams.sortOption}
                      options={[{ name: 'importance' }, { name: 'times_selected' }, { name: 'both' }]}
                      optionLabel="name" 
                      placeholder={data.setupParam.possibleSettings.defaultSettings.histParams.sortOption}
                      onChange={(event) => {
                        data.setupParam.possibleSettings.defaultSettings.histParams.sortOption = event.target.value.name;
                        data.internal.settings.histParams.sortOption = event.target.value.name;
                        setReload(!reload);
                      }} 
                    />
                  </Form.Group>
                </Row>
              )}

              {/*Heatmap method parameters*/}
              {(data.internal.settings.heatmap) && (
                <Row className={sectionCardClass}>
                  <Form.Group controlId="heatmapPlotParams" style={lastSectionStyle}>
                    <Form.Label className="heatmapPlotParams">Heatmap Options</Form.Label>
                    <Caption>
                      Configure heatmap visualization settings.
                    </Caption>
                    {/* Main heatmap metric */}
                    <Form.Group controlId="mainMetric" style={sectionStyle}>
                      <Form.Label className="mainMetric">Main Heatmap Metric</Form.Label>
                      <Caption>
                        Metric to display; use _mean for averaged values.
                      </Caption>
                      <InputText
                        style={{width: "270px", display: "block", margin: "0 auto"}}
                        value={data.setupParam.possibleSettings.defaultSettings.heatmapParams.metric}
                        placeholder={data.setupParam.possibleSettings.defaultSettings.heatmapParams.metric}
                        onChange={(event) => {
                          data.setupParam.possibleSettings.defaultSettings.heatmapParams.metric = event.target.value;
                          data.internal.settings.heatmapParams.metric = event.target.value;
                          setReload(!reload);
                        }}
                      />
                    </Form.Group>

                    {/* P-value yes or no */}
                    <Form.Group controlId="plotPvalues" style={sectionStyle}>
                      <Form.Label
                          className="plotPvalues">
                              Plot p-values
                      </Form.Label>
                      <Caption>Display p-values on heatmap.</Caption>
                      <InputSwitch 
                        checked={data.setupParam.possibleSettings.defaultSettings.heatmapParams.pValues}
                        onChange={(event) => {
                            data.setupParam.possibleSettings.defaultSettings.heatmapParams.pValues = event.target.value;
                            data.internal.settings.heatmapParams.pValues = event.target.value;
                            setReload(!reload);
                        }}
                      />
                    </Form.Group>

                    {/* P-value method */}
                    {(data.internal.settings.heatmapParams.pValues) && (
                      <Form.Group controlId="pValueMethod" style={sectionStyle}>
                        <Form.Label className="pValueMethod">P-value Method</Form.Label>
                        <Caption>Statistical test for p-value calculation.</Caption>
                        <Dropdown
                            value={data.setupParam.possibleSettings.defaultSettings.heatmapParams.pValuesMethod}
                            options={[{ name: 'delong' }, { name: 'ttest' }, { name: 'wilcoxon' }, { name: 'bengio' }]}
                            optionLabel="name" 
                            placeholder={data.setupParam.possibleSettings.defaultSettings.heatmapParams.pValuesMethod}
                            onChange={(event) => {
                              data.setupParam.possibleSettings.defaultSettings.heatmapParams.pValuesMethod = event.target.value.name;
                              data.internal.settings.heatmapParams.pValuesMethod = event.target.value.name;
                              setReload(!reload);
                            }} 
                        />
                      </Form.Group>
                    )}

                    {/* Extra metrics */}
                    <Form.Group controlId="extraMetics" style={sectionStyle}>
                      <Form.Label 
                        className="extraMetics"
                      >
                        Extra metrics
                      </Form.Label>
                      <Caption>Additional metrics separated by commas with suffixes.</Caption>
                      <InputText
                        style={{width: "270px", display: "block", margin: "0 auto"}}
                        value={data.setupParam.possibleSettings.defaultSettings.heatmapParams.extraMetrics}
                        placeholder={data.setupParam.possibleSettings.defaultSettings.heatmapParams.extraMetrics}
                        onChange={(event) => {
                          data.setupParam.possibleSettings.defaultSettings.heatmapParams.extraMetrics = event.target.value;
                          data.internal.settings.heatmapParams.extraMetrics = event.target.value;
                          setReload(!reload);
                        }}
                      />
                    </Form.Group>

                    {/* Title */}
                    <Form.Group controlId="plotTitle" style={lastSectionStyle}>
                      <Form.Label className="plotTitle">Plot Title (Optional)</Form.Label>
                      <Caption>Custom title displayed on the heatmap plot.</Caption>
                      <InputText
                        style={{width: "270px", display: "block", margin: "0 auto"}}
                        value={data.setupParam.possibleSettings.defaultSettings.heatmapParams.title}
                        placeholder="Ex: 'Glioma IDH classificaion: mean AUC heatmap'"
                        onChange={(event) => {
                          data.setupParam.possibleSettings.defaultSettings.heatmapParams.title = event.target.value;
                          data.internal.settings.heatmapParams.title = event.target.value;
                          setReload(!reload);
                        }}
                    />
                    </Form.Group>
                  </Form.Group>
                </Row>
              )}
              </Row>
            }
          </>
        }
      />
    </>
  )
}

export default Analyze
