import Image from "next/image"
import React, { useEffect, useState } from "react"
import {
  AlignLeft,
  Archive,
  BarChart3,
  Braces,
  Building2,
  Eye,
  FileCode,
  Folder,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  Lock,
  Microscope,
  Network,
  Notebook,
  Target,
  FileSpreadsheet,
} from "lucide-react"
import medomicsImg from "../../../../../resources/medomics.svg"
import DropzoneComponent from "../../../mainPages/dataComponents/dropzoneComponent"
import { collectionExists } from "../../../mongoDB/mongoDBUtils"

const iconClass = "icon-offset"
const iconSize = 14

const iconExtension = {
  folder: (isExpanded) =>
    isExpanded ? (
      <FolderOpen size={iconSize} className={iconClass} style={{ paddingBottom: "0.15rem" }} />
    ) : (
      <Folder size={iconSize} className={iconClass} style={{ paddingBottom: "0.15rem" }} />
    ),
  csv: <FileSpreadsheet size={iconSize} className="emoji" />,
  view: <Eye size={iconSize} className="emoji" />,
  json: (
    <span>
      <Braces size={iconSize} className={iconClass} style={{ color: "yellow" }} />
    </span>
  ),
  txt: (
    <span>
      <AlignLeft size={iconSize} className={iconClass} />
    </span>
  ),
  pdf: <FileSpreadsheet size={iconSize} className="emoji" style={{ color: "#e74c3c" }} />,
  html: <Globe size={iconSize} className="emoji" />,
  medomics: (
    <span>
      <Image src={medomicsImg} width={12} height={12} alt="medomics.svg" style={{ marginRight: "0.15rem" }} />
    </span>
  ),
  medml: <Target size={iconSize} className="emoji" />,
  medext: (
    <span className="emoji">
      <Image src={medomicsImg} width={18} height={18} alt="medomics.svg" style={{ marginRight: "0.15rem" }} />
    </span>
  ),
  mediml: (
    <span className="emoji">
      <Image src={medomicsImg} width={18} height={18} alt="medomics.svg" style={{ marginRight: "0.15rem" }} />
    </span>
  ),
  medmlres: <BarChart3 size={iconSize} className="emoji" />,
  medeval: <Microscope size={iconSize} className="emoji" />,
  zip: <Lock size={iconSize} className="emoji" />,
  medmodel: (
    <span>
      <Network size={iconSize} className={iconClass} style={{ color: "#97edfb" }} />
    </span>
  ),
  pkl: (
    <span>
      <Network size={iconSize} className={iconClass} style={{ color: "#5b95ff" }} />
    </span>
  ),
  ipynb: (
    <span>
      <Notebook size={iconSize} className={iconClass} style={{ color: "#5b95ff" }} />
    </span>
  ),
  png: (
    <span>
      <ImageIcon size={iconSize} className={iconClass} style={{ color: "#5b95ff" }} />
    </span>
  ),
  jpg: (
    <span>
      <ImageIcon size={iconSize} className={iconClass} style={{ color: "#5b95ff" }} />
    </span>
  ),
  jpeg: (
    <span>
      <ImageIcon size={iconSize} className={iconClass} style={{ color: "#5b95ff" }} />
    </span>
  ),
  svg: (
    <span>
      <ImageIcon size={iconSize} className={iconClass} style={{ color: "#5b95ff" }} />
    </span>
  ),
  rar: (
    <span>
      <Archive size={iconSize} className={iconClass} style={{ color: "#5b95ff" }} />
    </span>
  ),
  dcm: (
    <span>
      <Building2 size={iconSize} className={iconClass} style={{ color: "rgb(17, 231, 63)" }} />
    </span>
  ),
  dicom: (
    <span>
      <Building2 size={iconSize} className={iconClass} style={{ color: "rgb(17, 231, 63)" }} />
    </span>
  ),
  nii: (
    <span>
      <Building2 size={iconSize} className={iconClass} style={{ color: "rgb(17, 231, 63)" }} />
    </span>
  ),
  npy: (
    <span>
      <FileCode size={iconSize} className={iconClass} style={{ color: "rgb(255, 208, 0)" }} />
    </span>
  ),
}

/**
 * @param {string[]} classNames - list of class names
 * @returns {string} - concatenated class names
 * @abstract - filters out any falsy values and concatenates the rest
 */
const cx = (...classNames) => classNames.filter((cn) => !!cn).join(" ")

/**
 * @abstract - renders a single item in the tree
 * @param {Object} props
 * @param {Object} props.item - the item to render
 * @param {number} props.depth - the depth of the item in the tree
 * @param {React.ReactNode} props.children - the children of the item
 * @param {React.ReactNode} props.title - the title of the item
 * @param {React.ReactNode} props.arrow - the arrow of the item
 * @param {React.ReactNode} props.info - the info of the item
 * @param {Object} props.context - the context object passed by react-contexify
 * @param {Object} additionalParams - additional parameters passed by the tree
 * @param {Function} additionalParams.displayMenu - function to display the context menu
 * @returns {React.ReactNode} - the rendered item
 */
const RenderItem = ({ item, depth, children, title, context, arrow }, additionalParams) => {
  const InteractiveComponent = context.isRenaming ? "div" : "button"
  const type = context.isRenaming ? undefined : "button"
  // 1. Create a state to hold the actual value
  const [itemInMongoDB, setItemInMongoDB] = useState(false)

  // 2. Use useEffect to resolve the promise
  useEffect(() => {
    let isMounted = true; 
    
    collectionExists(item.index).then((result) => {
      if (isMounted) {
        setItemInMongoDB(result); // Update state with the actual boolean/value
      }
    });
    return () => { isMounted = false; }; // Cleanup to prevent memory leaks
  }, [item.index]); // Re-run if the item index changes

  const folderItemContent = (
    <li
      {...context.itemContainerWithChildrenProps}
      className={cx(
        "rct-tree-item-li",
        item.isFolder && "rct-tree-item-li-isFolder",
        context.isSelected && "rct-tree-item-li-selected",
        context.isExpanded && "rct-tree-item-li-expanded",
        context.isFocused && "rct-tree-item-li-focused",
        context.isDraggingOver && "rct-tree-item-li-dragging-over",
        context.isSearchMatching && "rct-tree-item-li-search-match"
      )}
    >
      <div
        {...context.itemContainerWithoutChildrenProps}
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
        className={cx(
          "rct-tree-item-title-container",
          item.isFolder && "rct-tree-item-title-container-isFolder",
          context.isSelected && "rct-tree-item-title-container-selected",
          context.isExpanded && "rct-tree-item-title-container-expanded",
          context.isFocused && "rct-tree-item-title-container-focused",
          context.isDraggingOver && "rct-tree-item-title-container-dragging-over",
          context.isSearchMatching && "rct-tree-item-title-container-search-match"
        )}
      >
        {/* if folder is expanded, show the folder bracket */}
        {/* {context.isExpanded && (
          <div
            className="folder-bracket"
            style={{ left: `${(depth + 1) * 12 + 8}px`, backgroundColor: "", width: "1px", transition: "all 0.5s ease-in-out" }}
          ></div>
        )} */}
        {arrow}
        <InteractiveComponent
          type={type}
          {...context.interactiveElementProps}
          className={cx(
            "rct-tree-item-button",
            item.isFolder && "rct-tree-item-button-isFolder",
            context.isSelected && "rct-tree-item-button-selected",
            context.isExpanded && "rct-tree-item-button-expanded",
            context.isFocused && "rct-tree-item-button-focused",
            context.isDraggingOver && "rct-tree-item-button-dragging-over",
            context.isSearchMatching && "rct-tree-item-button-search-match"
          )}
          data={item}
          onContextMenu={(e) => {
            console.log("onContextMenu", item.index, e, additionalParams, item)
            // additionalParams.setSelectedItems([item.UUID])
            additionalParams.displayMenu(e, item)
          }}
        >
          <div>
            {iconExtension.folder(context.isExpanded)}
            <span className="label">{title}</span>
          </div>
        </InteractiveComponent>
      </div>
      {children}
    </li>
  )

  return (
    <>
      {/* If the item is a folder, we render it as a dropzone */}
      {item.isFolder && (
        <>
          {additionalParams.isHovering && !additionalParams.isDropping ? (
            <div className="sidebar-dropzone-dirtree" style={{ display: "block", boxSizing: "border-box" }}>
              {folderItemContent}
            </div>
          ) : (
            <DropzoneComponent className="sidebar-dropzone-dirtree" item={item} noClick={true} setIsDropping={additionalParams.setIsDropping}>
              {folderItemContent}
            </DropzoneComponent>
          )}
        </>
      )}
      {!item.isFolder && (
        <>
          <li
            {...context.itemContainerWithChildrenProps}
            className={cx(
              "rct-tree-item-li",
              item.isFolder && "rct-tree-item-li-isFolder",
              context.isSelected && "rct-tree-item-li-selected",
              context.isExpanded && "rct-tree-item-li-expanded",
              context.isFocused && "rct-tree-item-li-focused",
              context.isDraggingOver && "rct-tree-item-li-dragging-over",
              context.isSearchMatching && "rct-tree-item-li-search-match"
            )}
          >
            <div
              {...context.itemContainerWithoutChildrenProps}
              style={{ paddingLeft: `${(depth + 1) * 10}px` }}
              className={cx(
                "rct-tree-item-title-container",
                item.isFolder && "rct-tree-item-title-container-isFolder",
                context.isSelected && "rct-tree-item-title-container-selected",
                context.isExpanded && "rct-tree-item-title-container-expanded",
                context.isFocused && "rct-tree-item-title-container-focused",
                context.isDraggingOver && "rct-tree-item-title-container-dragging-over",
                context.isSearchMatching && "rct-tree-item-title-container-search-match"
              )}
            >
              {/* {arrow} */}

              <InteractiveComponent
                type={type}
                {...context.interactiveElementProps}
                className={cx(
                  "rct-tree-item-button",
                  item.isFolder && "rct-tree-item-button-isFolder",
                  context.isSelected && "rct-tree-item-button-selected",
                  context.isExpanded && "rct-tree-item-button-expanded",
                  context.isFocused && "rct-tree-item-button-focused",
                  context.isDraggingOver && "rct-tree-item-button-dragging-over",
                  context.isSearchMatching && "rct-tree-item-button-search-match",
                  !item.isFolder && "rct-tree-item-isNotFolder"
                )}
                data={item}
                onContextMenu={(e) => {
                  console.log("onContextMenu", title)
                  additionalParams.displayMenu(e, item)
                }}
                onDoubleClick={(e) => {
                  console.log("onDoubleClick", title, item)
                  additionalParams.onDBClickItem(e, item)
                }}
              >
                <div>
                  {iconExtension[item.type]}
                  <span className="label">{title}</span>
                  {item.isLocked && (
                    <span className="emoji" title={`This item is used in ${additionalParams.dirTree[item.usedIn] ? additionalParams.dirTree[item.usedIn].data : "a generated notebook"}`}>
                      <Lock size={iconSize} />
                    </span>
                  )}
                  {additionalParams.showMongoDetails && itemInMongoDB && <img src="https://cdn3.emoji.gg/emojis/21146-mongodb.png" width="16px" height="16px" alt="mongodb" />}
                  {additionalParams.showMongoDetails && item.path && <img src="https://www.freeiconspng.com/uploads/floppy-save-icon--23.png" width="16px" height="16px" alt="local" />}
                </div>
              </InteractiveComponent>
            </div>
            {children}
          </li>
        </>
      )}
    </>
  )
}

export default RenderItem
