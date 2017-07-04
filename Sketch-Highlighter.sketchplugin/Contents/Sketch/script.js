var context;

var getLineRectsForTextLayer = function(textLayer, padding, factorInSelection){
	var textLayerOrigin = textLayer.frame().origin();
	var stringValue = textLayer.stringValue() + "";
	
	//	Create & size text container

	var textContainer = NSTextContainer.new();

	textContainer.size = NSMakeSize(
		textLayer.frame().size().width,
		Number.MAX_VALUE
	);
	
	//	Create layout manager & text storage

	var layoutManager = NSLayoutManager.new();
	var textStorage = NSTextStorage.new();
	
	textStorage.setAttributedString(textLayer.attributedStringValue());

	layoutManager.textStorage = textStorage;

	layoutManager.addTextContainer(textContainer);
	
	//	Prequisites

	var lineRects = [];
	var index = 0, numberOfGlyphs = layoutManager.numberOfGlyphs();

	//	Factor in selection

	var currentHandler = context.document.currentHandler();

	if(factorInSelection && currentHandler.textView){
		var selectedRange = currentHandler.textView().selectedRange();

		if(selectedRange.length > 0){
			index = selectedRange.location;
			numberOfGlyphs = NSMaxRange(selectedRange);
		}
	}

	//	Enumerate lines

	while(index < numberOfGlyphs){
		var endOfLineIndex;

		//	Get end of line index

		var lineRangePtr = MOPointer.new();

		[layoutManager lineFragmentUsedRectForGlyphAtIndex:index effectiveRange:lineRangePtr];
		
		endOfLineIndex = NSMaxRange(lineRangePtr.value());

		//	Get bounding rect
		//	Also ignore empty line ends and hard line breaks

		var rangeLength = Math.min(endOfLineIndex, numberOfGlyphs) - index;

		var lineText = stringValue.substr(index, rangeLength), trimmedLineText = lineText.trimRight();

		rangeLength -= (lineText.length - trimmedLineText.length);

		var glyphRange = NSMakeRange(index, rangeLength);
		var lineRect = [layoutManager boundingRectForGlyphRange:glyphRange inTextContainer:textContainer];

		//	Update index

		index = endOfLineIndex;

		//	Offset from text layer...

		lineRect.origin.x = textLayerOrigin.x;
		lineRect.origin.y += textLayerOrigin.y;

		//	Apply padding

		//	Top & bottom

		lineRect.origin.y -= padding.top;

		lineRect.size.height += padding.top;

		lineRect.size.height += padding.bottom;

		//	Left & right

		lineRect.origin.x -= padding.left;
		lineRect.size.width += padding.left;

		lineRect.size.width += padding.right;

		//	Store rect

		lineRects.push(lineRect);
	}

	return lineRects;
};

var createLineShapeGroupForTextLayer = function(textLayer, padding, factorInSelection){
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

		var bezierPath = NSBezierPath.bezierPathWithRect(lineRect);
		var shapeLayer = [MSShapePathLayer shapeWithBezierPath:bezierPath];

		shapeLayer.booleanOperation = 0; // Union
		shapeLayer.name = "Line " + (i + 1);

		//	Add shape group to main group

		shapeGroup.addLayer(shapeLayer);
	}

	//	Fit group to contents, give same origin as textLayer

	shapeGroup.resizeToFitChildrenWithOption(1);

	return shapeGroup;
};

var prompt = function(promptTitle, defaultValue){
	if(!defaultValue) defaultValue = "";

	var alert = [NSAlert
		alertWithMessageText:promptTitle
		defaultButton:"OK"
		alternateButton:"Cancel"
		otherButton:nil
		informativeTextWithFormat:""];

	var input = [[NSTextField alloc] initWithFrame:NSMakeRect(0, 0, 200, 24)];

	[input setStringValue:defaultValue];
	[alert setAccessoryView:input];
	[input selectText:nil];

	var pressedButtonIndex = [alert runModal];

	if(pressedButtonIndex == NSAlertDefaultReturn){
		[input validateEditing];

		return [input stringValue]+"";
	} else {
		return null;
	}
};

var alert = function(message, title){
	var alert = NSAlert.new();
	
	alert.messageText = title || "Alert";
	alert.informativeText = message+"";
	
	alert.runModal();
};

var SessionStorage = new function(){
	var ns = "com.matt-curtis.sketch-highlighter", nsPrefix = ns + ".";
	var dictionary = NSThread.mainThread().threadDictionary();

	this.get = function(key){
		key = nsPrefix + key;

		return dictionary[key];
	};

	this.set = function(key, value){
		key = nsPrefix + key;

		dictionary[key] = value;
	};
};

var promptUserForAndReturnPadding = function(){
	var paddingString = prompt("Enter padding (i.e. top,right,bottom,left).\nUse negative values to create inset.", "0,0,0,0");

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

var onRun = function(_context){
	context = _context;

	//	Grab and confirm selected text layer(s)

	var selectedLayers = context.selection;
	var foundTextLayers = false;
	var padding;

	for(var i = 0; i < selectedLayers.length; i++){
		var layer = selectedLayers[i];

		if(layer.class() != MSTextLayer.class()) continue;

		//	Found text layer - prompt user for padding

		if(!foundTextLayers){
			foundTextLayers = true;

			padding = promptUserForAndReturnPadding();

			if(!padding) break;
		}

		//	Insert lines behind text layer

		var parentGroup = layer.parentGroup();

		var lineShapeGroup = createLineShapeGroupForTextLayer(layer, padding, true);

		var destinationIndex = parentGroup.layers().indexOfObject(layer);
		
		[parentGroup insertLayer:lineShapeGroup atIndex:destinationIndex];
	}

	if(!foundTextLayers){
		//	Hey - no text layers found.

		alert("No text layers in selection.");
	}
};