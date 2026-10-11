import MEDiml
from ..node import Node
from ..pipeline import Pipeline

class SegmentationNode(Node):
    """
    Subclass of Node that implements the segmentation of a volume.
    """
    def __init__(self, params: dict):
        super().__init__(params)

        if 'rois_data' not in list(self.params.keys()):
            raise ValueError("Missing 'rois_data' parameter in SegmentationNode parameters.")

        self.selected_rois = self.params['rois_data']

    def change_params(self, new_params: dict) -> None:
        # The ROIs selection changed in the scene must be used by the next run of the saved workflow
        super().change_params(new_params)
        self.selected_rois = self.params['rois_data']

    def run(self, pipeline: Pipeline):
        print("************************ RUNNING SEGMENTATION ***************************")
        # Extract the ROI mask (returns two image_volume_objects: vol_obj_init and roi_obj_init)
        vol_obj_init, roi_obj_init = MEDiml.processing.get_roi_from_indexes(
            pipeline.MEDimg,
            name_roi=self.selected_rois,
            box_string="full"
        )
        
        # Update the latest output object of the pipeline
        pipeline.latest_node_output["vol"] = vol_obj_init
        pipeline.latest_node_output["roi"] = roi_obj_init
        
        # Update the output of the node
        self.output["vol"] = vol_obj_init.data
        self.output["roi"] = roi_obj_init.data
        
        # Update settings results of the pipeline
        pipeline.settings_res['segmentation'] = self.params