/* eslint-disable no-undef */
import React from "react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { Button } from "react-bootstrap"
import { RotateCw as ArrowClockwise, ZoomIn, ZoomOut } from "lucide-react"
const nativeImage = require("electron").nativeImage

/**
 * @description - This component is the zoom pan pinch component that will be used to zoom in and out of images
 * @returns the zoom pan pinch component
 * @param {Object} props - The props object
 * @param {String} props.imagePath - The path to the image to display
 * @param {Object} props.options - The options object
 * @param {String} props.image - The image to display
 * @param {Number} props.height - The height of the image
 * @param {Number} props.width - The width of the image
 */
const ZoomPanPinchComponent = ({ imagePath, options = undefined, image, height, width }) => {
  // We check if the image path is defined
  if (imagePath !== undefined && image === undefined) {
    image = nativeImage.createFromPath(imagePath).toDataURL()
    if (height === undefined) {
      height = nativeImage.createFromPath(imagePath).getSize().height
    }
    if (width === undefined) {
      width = nativeImage.createFromPath(imagePath).getSize().width
    }
  }


  return (
    <TransformWrapper initialScale={1} initialPositionX={100} initialPositionY={100} {...options} >
      {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
        <React.Fragment>
          <div className="tools">
            {/* aria-label on each: these are icon-only controls, so without it
                a screen reader announces "button" with no indication of what it
                does. A magnifier glyph is one of the few that is genuinely
                universal, which is why icon-only is acceptable here at all. */}
            <Button onClick={() => zoomIn()} aria-label="Zoom in">
              <ZoomIn aria-hidden="true" />
            </Button>
            <Button onClick={() => zoomOut()} aria-label="Zoom out">
              <ZoomOut aria-hidden="true" />
            </Button>
            <Button onClick={() => resetTransform()} aria-label="Reset zoom">
              <ArrowClockwise aria-hidden="true" />
            </Button>
          </div>
          <TransformComponent>
            <img className="imageViewer" src={image} alt="test" width={width} height={height} style={{ height: height, width: width }} data={rest}/>
          </TransformComponent>
        </React.Fragment>
      )}
    </TransformWrapper>
  )
}

export default ZoomPanPinchComponent
