function slider () {
    
    var opt = {
	width: 100,
	pos: undefined, /* Domain assumes to be [0, 1] */
        event: null,
	scale: d3.scaleLinear().domain([0, 1]).range([0, 100]).nice().clamp(true),
	vertical: false,
	range_ext: null,
	ticks: 5,
	text: null,
	label: "Label",
	verbose: true,
	event: null,
	dv: 0, //  longitudinal deviation
	dl: 0, // vertical deviation
	ldv: 0, // Label: longitudinal deviation 
	ldl: -20, // Label: vertical deviation
	brush: true,
	nFloat:2
    };
    
    var curr_text;
    
    if (opt.scale)
	opt.range_ext = opt.scale.range();
    else
	opt.range_ext = [0, opt.width];
    
    var coord, sliderG, hint, defaultPos, info;
    
    function obj (selection) {	
        coord= opt.vertical ? ["y1", "y2", "cy", "cx", "y", "dx", "dy"] : ["x1", "x2", "cx", "cy", "x", "dy", "dx"];
	sliderG= selection.append("g")
	    .attr("class", "slider");
	
	var track = sliderG.append("line")
		.attr("class", "track")
		.attr(coord[0], opt.range_ext[0])
		.attr(coord[1], opt.range_ext[1])
		.select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
		.attr("class", "track-inset")
		.select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
		.attr("class", "track-overlay");
	
	if (opt.pos !== undefined)
	    opt.pos = opt.pos;
	else
	    opt.pos = d3.mean(opt.scale.domain());
	
	if (defaultPos === undefined)
	    defaultPos = opt.pos;
	
	opt.pos = formatAsFloat(opt.pos);
	var handle = sliderG.insert("circle", ".track-overlay")
		.attr("class", "handle")
		.attr("r", 9)
		.attr(coord[2], opt.scale(opt.pos));
	
	
	hint = selection.append("g")
	    .attr("class", "slider-hint");
	
	var hint_axis = hint.append("g")
		.attr("class", "axis axis-variable");
	
	if (opt.vertical)
	    hint_axis.call(d3.axisLeft(opt.scale).ticks(opt.ticks));
	else
	    hint_axis.call(d3.axisBottom(opt.scale).ticks(opt.ticks));	
	
	
	curr_text = opt.text ? opt.text(opt.pos, formatAsFloat(defaultPos), info) : opt.pos;
	// var hint_text = hint.append("g")
	// 	.attr("class", "verbose-text")
	// 	.append("text")
	// 	.style("text-anchor", "middle")
	// 	.attr(coord[5], opt.dv)
	// 	.attr(coord[6], opt.dl)
	// 	.text(curr_text);
	
	var hint_text = hint.append("g")
		.attr("class", "verbose-text");

	if (opt.vertical)
	    hint_text.attr("transform", "translate(" + (opt.dv) + "," + (opt.dl) + ")");
	else
	    hint_text.attr("transform", "translate(" + (opt.dl) + "," + (opt.dv) + ")");
	
	hint_text = hint_text
	    .append("text")
	    .style("text-anchor", "middle")
	    .html(curr_text);

	var label = hint_axis.append("g")
		.attr("class", "slider-label")
		.append("text")
		.style("text-anchor", "middle")
		.attr(coord[5], opt.ldv)
		.attr(coord[6], opt.ldl)
		.html(opt.label);
	
        var drag = d3.drag().on("drag", function() {
	    
            opt.pos = opt.scale.invert(d3.event[coord[4]]);	    
	    handle.attr(coord[2], opt.scale(opt.pos));

	    if (opt.verbose) {
		opt.pos = +formatAsFloat(opt.pos);
		if (opt.text)
		    curr_text = opt.text(opt.pos, formatAsFloat(defaultPos), info);
		else
		    curr_text = opt.pos;
		hint_text.html(curr_text);
	    }
	    
	    if (opt.event)
		opt.event(opt.pos);
	    
        });
	
	if (opt.brush)
	    track.call(drag);
    }
    
    function formatAsFloat(d) {
	if (d % 1 !== 0) {
            return d3.format("."+(opt.nFloat)+"f")(d);
	} else {
            return d3.format(".0f")(d);
	}
    }
    
    
    obj.width = function (val) {
        opt.width = val;
	if (opt.scale)
	    opt.scale.range([0,val]);
	opt.range_ext = [0,val];
        return obj;
    };
    
    obj.nFloat = function (val) {
        opt.nFloat = val;
        return obj;
    };
    
    obj.pos = function (val) {
	if (val !== undefined) {
            opt.pos = val;
            return obj;
	} else {
	    return opt.pos;
	}
    };

    obj.defaultPos = function(val) {
	if (val !== undefined) {
            defaultPos = val;
            return obj;
	} else {
	    return defaultPos;
	}
    };

    obj.info = function(val) {
	if (val !== undefined) {
	    info = val;
	    return obj;
	} else {
	    return info;
	}
    };
    
    obj.setPos = function (val) {
	opt.pos = +formatAsFloat(val);
	sliderG.select("circle.handle")
	    .attr(coord[2], opt.scale(opt.pos));
	
	curr_text = opt.text ? opt.text(opt.pos, formatAsFloat(defaultPos), info) : opt.pos;
	hint.select("g.verbose-text")
	    .select("text")
	    .html(curr_text);
    };
    
    obj.setDefaultPos = function (val) {
	defaultPos = +val;
	
	curr_text = opt.text ? opt.text(opt.pos, formatAsFloat(defaultPos), info) : opt.pos;
	hint.select("g.verbose-text")
	    .select("text")
	    .html(curr_text);
    };

     obj.setInfo = function (val) {
	 info = +val;
	 
	 curr_text = opt.text ? opt.text(opt.pos, formatAsFloat(defaultPos), info) : opt.pos;
	 hint.select("g.verbose-text")
	     .select("text")
	     .html(curr_text);
     };

    obj.setPosAsDefaultPos = function () {
	opt.pos = defaultPos;
	sliderG.select("circle.handle")
	    .attr(coord[2], opt.scale(opt.pos));
	
	curr_text = opt.text ? opt.text(formatAsFloat(opt.pos), formatAsFloat(defaultPos), info) : opt.pos;
	hint.select("g.verbose-text")
	    .select("text")
	    .html(curr_text);
    };
    
    obj.event = function (val) {
	opt.event = val;
	return obj;
    };
    
    obj.scale = function (val) {
        opt.scale = val;
	opt.range_ext = opt.scale.range();
	return obj;
    };

    obj.vertical = function (val) {
	if (val!=undefined) {
            opt.vertical = val;	    
            return obj;
	} else {
	    return opt.vertical;
	}
    };

    obj.ticks = function (val) {
	opt.ticks = val;
	return obj;
    };
    
    obj.text = function (val) {
	if (val!=undefined) {	    
	    opt.text = val;
	    return obj;
	} else {
	    return curr_text;
	}
    };

    obj.verbose = function (val) {
	opt.verbose = val;
	return obj;
    };

    obj.dl = function (val) {
	opt.dl = val;
	return obj;
    };

    obj.dv = function (val) {
	opt.dv = val;
	return obj;
    };

    obj.ldl = function (val) {
	opt.ldl = val;
	return obj;
    };

    obj.ldv = function (val) {
	opt.ldv = val;
	return obj;
    };

    obj.label = function (val) {
	opt.label = val;
	return obj;
    };

    obj.setLabel = function (val) {
	opt.label = val;
	hint.select("g.slider-label")
	    .select("text")
	    .html(val);
    };
    
    obj.brush = function (val) {
	opt.brush = val;
	return obj;
    };
    
    return obj;
}
