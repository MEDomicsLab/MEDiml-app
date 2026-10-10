import { InputText } from 'primereact/inputtext'
import { useState } from "react"
import { Form, Row } from "react-bootstrap"
import DocLink from "../../extractionMEDiml/docLink"
import Node, { updateHasWarning } from "../../flow/node"
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
const Design = ({ id, data, type }) => { 
  const [reload, setReload] = useState(false)
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
            <Row 
              className={sectionCardClass} 
              style={{ maxHeight: "400px", overflowY: "auto", overflowX: "hidden", paddingRight: "8px" }}
            >
              <DocLink
                linkString={"https://medomicslab.gitbook.io/MEDiml-app-docs/learning"}
                name={"Learn more about the nodes"}
                image={"https://www.svgrepo.com/show/521262/warning-circle.svg"}
              />

              {/* Experiment Name */}
              <Form.Group controlId="expName" style={sectionStyle}>
              <Form.Label 
                  className="expName">
                      Experiment Name
              </Form.Label>
              <Caption>Unique identifier for the analysis experiment.</Caption>
                <InputText
                  style={{width: "300px", display: "block", margin: "0 auto"}}
                  value={data.internal.settings.expName || data.setupParam.possibleSettings.defaultSettings.expName}
                  placeholder="Ex: Problem_RadiomicsLevel_Modality"
                  onChange={(event) => {
                    data.setupParam.possibleSettings.defaultSettings.expName = event.target.value;
                    data.internal.settings.expName = event.target.value;
                    updateHasWarning(data);
                    setReload(!reload);
                  }}
                />
              </Form.Group>
            </Row>
          </>
        }
      />
    </>
  )
}

export default Design
