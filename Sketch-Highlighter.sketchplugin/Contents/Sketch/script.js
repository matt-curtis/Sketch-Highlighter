//	Requires

var Sketch = require("sketch");
var { Document, Text, UI } = Sketch;
//var SessionStorage = require("./SessionStorage");

//	Script Entry Point

var onRun = function(context){
	var document = Sketch.fromNative(context.document);

	//	Grab and selected text layer(s)

	var foundTextLayers = false;
	var desiredPadding;

	for(let layer of document.selectedLayers.layers){
		if(layer.type != Sketch.Types.Text) continue;

		//	Found text - did we prompt user for padding?
		//	If not, ask:

		if(!foundTextLayers){
			foundTextLayers = true;

			desiredPadding = promptUserForAndReturnPadding();

			if(!desiredPadding){
				//	User cancelled, exit loop

				break;
			}
		}

		//	Insert lines behind text layer

		var parentGroup = layer.parent;

		var lineShapeGroup = createLineShapeGroupForTextLayer(layer, desiredPadding, true);

		lineShapeGroup.parent = parentGroup;

		//	Movement :( (layer.index is not writable!)

		var targetIndex = layer.index - 1;
		var formerIndex = -1; // fail-safe to avoid infinite loop(?)

		while(lineShapeGroup.index != formerIndex && lineShapeGroup.index != targetIndex){
			formerIndex = lineShapeGroup.index;
			
			lineShapeGroup.moveBackward();
		}
	}

	//	Did we find any text layers?
	//	If not, let the user know:

	if(!foundTextLayers){
		UI.alert(
			"🤷‍♀ Select some text layers, please!",
			"Hey I just met you\nand this is crazy\nbut no text's selected\nso select some maybe"
		);
	}
};

//	Helpers

var getLineRectsForTextLayer = function(textLayer, padding, shouldFactorInSelection){
	var lineRects = [];

	var startingIndex = 0, maxIndex = Number.MAX_VALUE;

	//	If this layer is in edit mode
	//	limit the lines we gather to what's selected:

	var editingTextView = context.document.currentHandler().textView;

	if(shouldFactorInSelection && editingTextView){
		var selectedRange = editingTextView.selectedRange();
		
		if(selectedRange.length > 0){
			startingIndex = selectedRange.location;
			maxIndex = NSMaxRange(selectedRange);
		}
	}

	//	Enumerate lines

	for(let fragment of textLayer.fragments){
		const range = fragment.range;
		
		if(range.location < startingIndex) continue;
		if(range.location >= maxIndex) break;
		
		const lineRect = new Sketch.Rectangle(
			fragment.rect.x, fragment.rect.y, fragment.rect.width, fragment.rect.height
		);
		
		//	Offset from text layer...

		lineRect.x = textLayer.frame.x;
		lineRect.y += textLayer.frame.y;

		//	Apply padding

		//	Top & bottom

		lineRect.y -= padding.top;

		lineRect.height += padding.top;

		lineRect.height += padding.bottom;

		//	Left & right

		lineRect.x -= padding.left;
		lineRect.width += padding.left;

		lineRect.width += padding.right;

		//	Store rect

		lineRects.push(lineRect);
	};

	return lineRects;
};

function createLineShapeGroupForTextLayer(textLayer, padding, factorInSelection){
	//	Create shape group

	var shapeGroup = MSShapeGroup.new();

	shapeGroup.name = "Lines Shape";

	//	Apply fill

	shapeGroup.style().addStylePartOfType(0);

	//	Add line rects as shapes

	var lineRects = getLineRectsForTextLayer(textLayer, padding, factorInSelection);

	for(var i = 0; i < lineRects.length; i++){
		var lineRect = lineRects[i];

		//	Create shape layer

		var bezierPath = NSBezierPath.bezierPathWithRect(lineRect.asCGRect());
		var shapeLayer = MSShapePathLayer.shapeWithBezierPath(bezierPath);

		shapeLayer.booleanOperation = 0; // Union
		shapeLayer.name = "Line " + (i + 1);

		//	Add shape group to main group

		shapeGroup.addLayer(shapeLayer);
	}

	//	Fit group to contents, give same origin as textLayer

	shapeGroup.resizeToFitChildrenWithOption(1);

	return Sketch.fromNative(shapeGroup);
};

function promptUserForAndReturnPadding(){
	var paddingString = UI.getStringFromUser(
		"Enter padding (i.e. top,right,bottom,left).\nUse negative values to create inset.", "0,0,0,0"
	);

	if(!paddingString) return null;

	var paddingValueStrings = paddingString.split(",");
	
	var padding = {
		top: parseFloat(paddingValueStrings[0]) || 0,
		right: parseFloat(paddingValueStrings[1]) || 0,
		bottom: parseFloat(paddingValueStrings[2]) || 0,
		left: parseFloat(paddingValueStrings[3]) || 0
	};

	if(paddingValueStrings.length == 1){
		padding.right = padding.bottom = padding.left = padding.top;
	} else if(paddingValueStrings.length == 2){
		padding.bottom = padding.top;
		padding.left = padding.right;
	}

	return padding;
};