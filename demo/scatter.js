function scatterPlot (settings) {
    var chart = {};
    
    chart.objs = {mainDiv: null, chartDiv: null, g: null, xAxis: null, yAxis: null};
    chart.settings = {
	data: null,
	brush: false,
	getX: null,
	xName: "xName",
	xAxis: {ticks: 5, formatter: null, label: null, scale: "linear", nFloat: 2, range: null, zoomX: true},
	getY: null,
	yName: "yName",
	yAxis: {ticks: 5, formatter: null, label: null, scale: "linear", nFloat: 2, range: null, zoomY: true},
	hoverInfoFormatter: ((x,y, _) => {return "X: " + (x)+ "<br\>Y: " + (y); }),
	selector: null,
	chartSize: {width: 600, height: 300},
	margin: {left: 50, right: 20, top: 40, bottom: 40},
	clickEvent: null,
	mouseOverEvent: null,
	mouseOutEvent: null
    };
    
    for (var key in settings) {
	chart.settings[key] = settings[key];
    }
    
    function shallowCopy(oldObj) {
        var newObj = {};
        for (var i in oldObj) {
            if (oldObj.hasOwnProperty(i)) {
                newObj[i] = oldObj[i];
            }
        }
        return newObj;
    }
    
    function formatAsFloat(val) {
	n = val || 2;
	return d => {
            if (d % 1 !== 0) {
		return d3.format("."+n+"f")(d);
            } else {
		return d3.format(".0f")(d);
            }
	};
    }

    function logFormatNumber(val) {
	n = val || 2;
	return d => {
            var x = Math.log(d) / Math.log(10) + 1e-6;
            return Math.abs(x - Math.floor(x)) < 0.6 ? formatAsFloat(d, n) : "";
	};
    }

    !function prepareSettings() {
	chart.data = chart.settings.data;
	chart.margin = chart.settings.margin;
	chart.divWidth = chart.settings.chartSize.width;
        chart.divHeight = chart.settings.chartSize.height;
	
	chart.width = chart.divWidth - chart.margin.left - chart.margin.right;
	chart.height = chart.divHeight - chart.margin.top - chart.margin.bottom;
	
	if (chart.settings.xAxis.label) {
            chart.xAxisLable = chart.settings.xAxis.label;
        } else {
            chart.xAxisLable = chart.settings.xName;
        }
	
	if (chart.settings.yAxis.label) {
            chart.yAxisLable = chart.settings.yAxis.label;
        } else {
            chart.yAxisLable = chart.settings.yName;
        }
	
	if (chart.settings.xAxis.scale === 'log') {
            chart.xScale = d3.scaleLog();
	    chart.xFormatter = (typeof chart.settings.xAxis.formatter == "function") ? chart.settings.xAxis.formatter : logFormatNumber(chart.settings.xAxis.nFloat);
	} else {
	    chart.settings.xAxis.scale = 'linear';
            chart.xScale = d3.scaleLinear();
	    chart.xFormatter = (typeof chart.settings.xAxis.formatter == "function") ? chart.settings.xAxis.formatter : formatAsFloat(chart.settings.xAxis.nFloat);
        }
	
        if (chart.settings.yAxis.scale === 'log') {
            chart.yScale = d3.scaleLog();
	    chart.yFormatter = (typeof chart.settings.yAxis.formatter == "function") ? chart.settings.yAxis.formatter : logFormatNumber(chart.settings.yAxis.nFloat);
	} else {
	    chart.settings.yAxis.scale = 'linear';
            chart.yScale = d3.scaleLinear();
	    chart.yFormatter = (typeof chart.settings.yAxis.formatter == "function") ? chart.settings.yAxis.formatter : formatAsFloat(chart.settings.yAxis.nFloat);
        }
	
	chart.getX = chart.settings.getX;
	chart.getY = chart.settings.getY;
	
	chart.xRange = chart.settings.xAxis.range || d3.extent(chart.data, chart.getX);
	chart.yRange = chart.settings.yAxis.range || d3.extent(chart.data, chart.getY);	

	if (chart.settings.xAxis !== undefined && (chart.settings.xAxis.upperLimit !== undefined))
	    chart.xRange = [chart.xRange[0], chart.settings.xAxis.upperLimit];
	if (chart.settings.xAxis !== undefined && (chart.settings.xAxis.lowerLimit !== undefined))
	    chart.xRange = [chart.settings.xAxis.lowerLimit, chart.xRange[1]];	    

	if (chart.settings.yAxis !== undefined && (chart.settings.yAxis.upperLimit !== undefined))
	    chart.yRange = [chart.yRange[0], chart.settings.yAxis.upperLimit];
	if (chart.settings.yAxis !== undefined && (chart.settings.yAxis.lowerLimit !== undefined))
	    chart.yRange = [chart.settings.yAxis.lowerLimit, chart.yRange[1]];

	chart.xScale.domain(chart.xRange).range([0, chart.width]).nice();
	chart.yScale.domain(chart.yRange).range([chart.height, 0]).nice();	
	
	chart.xScale0 = chart.xScale.copy();
	chart.yScale0 = chart.yScale.copy();
	chart.xRange0 = chart.xScale0.domain();
	chart.yRange0 = chart.yScale0.domain();	

	chart.objs.xAxis = d3.axisBottom(chart.xScale).tickFormat(chart.xFormatter)
	    .ticks(chart.settings.xAxis.ticks);
	chart.objs.yAxis = d3.axisLeft(chart.yScale).tickFormat(chart.yFormatter)
	    .ticks(chart.settings.yAxis.ticks);
    }();
    
    
    chart.updateEnv = function(opts) {
	if (opts.xAxis != undefined) {
	    if (opts.xAxis.label){
		chart.xAxisLable = opts.xAxis.label;
		chart.objs.axis.xLabel.text(chart.xAxisLable);
	    }
	    if (opts.xAxis.scale === 'log') {
		if (opts.xAxis.scale !== chart.settings.xAxis.scale) {
		    chart.settings.xAxis.scale = opts.xAxis.scale;
		    chart.xScale = d3.scaleLog();
		}
		chart.xFormatter = (typeof opts.xAxis.formatter == "function") ? opts.xAxis.formatter : logFormatNumber(opts.xAxis.nFloat);
	    } else {
		chart.xScale = d3.scaleLinear();
		chart.xFormatter = (typeof opts.xAxis.formatter == "function") ? opts.xAxis.formatter : formatAsFloat(opts.xAxis.nFloat);
	    }
	    if (opts.xAxis.ticks)
		chart.settings.xAxis.ticks = opts.xAxis.ticks;
	}
	
	if (opts.yAxis != undefined) {
	    if (opts.yAxis.label){
		chart.yAxisLable = opts.yAxis.label;
		chart.objs.axis.yLabel.text(chart.yAxisLable);
	    }
	    if (opts.yAxis.scale === 'log') {
		if (opts.xAxis.scale !== chart.settings.xAxis.scale) {
		    chart.settings.xAxis.scale = opts.xAxis.scale;
		    chart.yScale = d3.scaleLog();
		}
		chart.yFormatter = (typeof opts.yAxis.formatter == "function") ? opts.yAxis.formatter : logFormatNumber(opts.yAxis.nFloat);
	    } else {
		chart.yScale = d3.scaleLinear();
		chart.yFormatter = (typeof opts.yAxis.formatter == "function") ? opts.yAxis.formatter : formatAsFloat(opts.yAxis.nFloat);
	    }
	    if (opts.yAxis.ticks)
		chart.settings.yAxis.ticks = opts.yAxis.ticks;
	}
	
	if (opts.getX !== undefined) {
	    chart.getX = opts.getX;
	    if (opts.xAxis !== undefined && opts.xAxis.range !== undefined)
		chart.xRange =  opts.xAxis.range;
	    else {
		chart.xRange = d3.extent(chart.data, chart.getX) || chart.xRange;
		if (opts.xAxis !== undefined && (opts.xAxis.upperLimit !== undefined))
		    chart.xRange = [chart.xRange[0], opts.xAxis.upperLimit];
		if (opts.xAxis !== undefined && (opts.xAxis.lowerLimit !== undefined))
		    chart.xRange = [opts.xAxis.lowerLimit, chart.xRange[1]];	    
	    }
	    chart.xScale.domain(chart.xRange).range([0, chart.width]).nice();
	    
	    chart.xScale0 = chart.xScale.copy();
	    chart.xRange0 = chart.xScale0.domain();
	    
	    chart.objs.xAxis = d3.axisBottom(chart.xScale).tickFormat(chart.xFormatter)
		.ticks(chart.settings.xAxis.ticks);
	    chart.objs.axis.xAxis.call(chart.objs.xAxis);
	}
	
	if (opts.getY !== undefined) {
	    chart.getY = opts.getY;
	    if (opts.yAxis !== undefined && opts.yAxis.range !== undefined) {
		chart.yRange = opts.yAxis.range;
	    }
	    else {
		chart.yRange =  d3.extent(chart.data, chart.getY) || chart.yRange;
		if (opts.yAxis !== undefined && (opts.yAxis.upperLimit !== undefined))
		    chart.yRange = [chart.yRange[0], opts.yAxis.upperLimit];
		if (opts.yAxis !== undefined && (opts.yAxis.lowerLimit !== undefined))
		    chart.yRange = [opts.yAxis.lowerLimit, chart.yRange[1]];
	    }
	    chart.yScale.domain(chart.yRange).range([chart.height, 0]).nice();
	    
	    chart.yScale0 = chart.yScale.copy();
	    chart.yRange0 = chart.yScale0.domain();
	    
	    chart.objs.yAxis = d3.axisLeft(chart.yScale).tickFormat(chart.yFormatter)
		.ticks(chart.settings.yAxis.ticks);
	    chart.objs.axis.yAxis.call(chart.objs.yAxis);
	}	    
    };

    
    function tooltipsHover(info) {
        return function () {
            chart.objs.tooltip.transition().duration(200).style("opacity", 0.9);
            chart.objs.tooltip.html(info);
        };
    }        
    
    !function prepareChart() {
	// Build main div and chart div
        chart.objs.mainDiv = d3.select(chart.settings.selector)
            .style("max-width", chart.divWidth + "px");
	// Add all the divs to make it centered and responsive
        chart.objs.innerDiv = chart.objs.mainDiv.append("div")
            .attr("class", "inner-wrapper");
	// .style("padding-bottom", (chart.divHeight / chart.divWidth) * 100 + "%");
        chart.objs.innerDiv
            .append("div").attr("class", "outer-box")
            .append("div").attr("class", "inner-box");

	// Capture the inner div for the chart (where the chart actually is)
        chart.selector = chart.settings.selector + " .inner-box";
        chart.objs.chartDiv = d3.select(chart.selector);

	//d3.select(window).on('resize.' + chart.selector, chart.update);
	
        // Create the svg
        chart.objs.svg = chart.objs.chartDiv.append("svg")
            .attr("class", "chart-area")
            .attr("width", chart.width + (chart.margin.left + chart.margin.right))
            .attr("height", chart.height + (chart.margin.top + chart.margin.bottom));


        chart.objs.g = chart.objs.svg.append("g")
            .attr("transform", "translate(" + chart.margin.left + "," + chart.margin.top + ")");

	
        // Create axis
	chart.objs.axis = {xAxis: null, yAxis: null, xLabel: null, yLabel: null, g: null};
        chart.objs.axis.g = chart.objs.g.append("g").attr("class", "axis");
	
	chart.objs.axis.xAxis = chart.objs.axis.g.append("g")
            .attr("class", "axis axis-x")
            .attr("transform", "translate(0," + chart.height + ")")
            .call(chart.objs.xAxis);
	
	chart.objs.axis.xLabel = chart.objs.axis.g.append("g")
	    .attr("class", "x-label")
	    .attr("transform", "translate(0," + chart.height + ")")
	    .append('text')
	    .attr("x", chart.width/2)
	    .attr('dy', "2.8em")
	    .attr("text-anchor", "middle")	
	    .text(chart.xAxisLable);
	
        chart.objs.axis.yAxis = chart.objs.axis.g.append("g")
            .attr("class", "axis axis-y")
            .call(chart.objs.yAxis);
	
	chart.objs.axis.yLabel = chart.objs.axis.g.append("g")
	    .attr("class", "y-label")
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -chart.height / 2)
            .attr("dy", "-3.2em")
            .attr("text-anchor", "middle")
            .text(chart.yAxisLable);
	
	chart.objs.tooltip = chart.objs.mainDiv.append('div').attr('class', 'tooltip');
    }();
    
    
    chart.updateLabel = function (options) {
	if ("xName" in options) {
	    chart.xAxisLable = options["xName"];
	    chart.objs.axis.xLabel.text(chart.xAxisLable);	    
	}
	if ("yName" in options) {
	    chart.yAxisLable = options["yName"];
	    chart.objs.axis.yLabel.text(chart.yAxisLable);
	}
    };

    chart.renderPlot = function (options) {
	chart.plot = {};
	chart.plot.styleProperty = {};
	
	var idleTimeout = null,
	    idleDelay = 350;
	
	var defaultOptions = {
	    getColor: ((d,i) => "#5A9BD5"),
	    getOpacity: ((d,i) => 1),
	    getSize: ((d, i) => 3),
	    update: false,
	    show: true,
	    remove: false,
	    interpolation: null
	};
	chart.plot.options = shallowCopy(defaultOptions);
	for (var key in options) {
	    chart.plot.options[key] = options[key];
	}		
	var vOpts = chart.plot.options;
	
	chart.plot.updateStyle = function(opts) {
	    if(opts == undefined) return;	    
	    var plot = chart.plot.g;
	    
	    if ("getColor" in opts) {
		chart.plot.options.getColor = opts.getColor;
		plot.selectAll("circle")
		    .style("fill", (d,i) => opts.getColor(d,i));
	    }
	    
	    if ("getOpacity" in opts) {
		chart.plot.options.getOpacity = opts.getOpacity;
		plot.selectAll("circle")
		    .style("opacity", (d,i) => opts.getOpacity(d,i));
	    }
	    
	    if ("getSize" in opts) {
		chart.plot.options.getSize = opts.getSize;
		plot.selectAll("circle")
		    .attr("r", (d,i) => chart.plot.options.getOpacity(d,i));
	    }
	};
	
	
	chart.plot.updateData = function(opts) {
	    // xAxis: {range: value, upperLimit: value, lowerLimit: value} 
	    // yAxis: {range: value, upperLimit: value, lowerLimit: value}

	    if (opts.data !== undefined) {
		chart.data = opts.data;
		chart.plot.remove();
		chart.updateEnv(opts);
	    }
	    
	    chart.plot.prepare();
	    chart.plot.change();
	};
	
	chart.plot.change = function(updateOptions) {
	    if (updateOptions) {
                for (var key in updateOptions) {
                    vOpts[key] = updateOptions[key];
                }
            }
            chart.plot.update();
	    chart.plot.tooltipsHover();
	};
	
	chart.plot.reset = function() {
	    chart.plot.change(defaultOptions);
	};
	
	chart.plot.show = function(opts) {
	    if (opts !== undefined) {
                opts.show = true;
                if (opts.reset) {
                    chart.plot.reset();
                }
            } else {
                opts = {show: true};
            }
            chart.plot.change(opts);
	};
	
	chart.plot.hide = function(opts) {
	     if (opts !== undefined) {
                opts.show = false;
                if (opts.reset) {
                    chart.plot.reset();
                }
            } else {
                opts = {show: false};
            }
            chart.plot.change(opts);
	};
	
	chart.plot.remove = function() {
	    chart.plot.g.remove();
	};
	
	chart.plot.update = function() {
	    var plot = chart.plot.g;
	    
	    plot.append("g")
		.attr("class", "plot")
		.attr("clip-path", "url(#"+ chart.settings.selector.slice(1) + "clip)")
		.selectAll("circle")
		.data(chart.data)
		.enter().append("circle")
		.attr("cx", (d,i) => chart.xScale(chart.getX(d,i)))
		.attr("cy", (d,i) => chart.yScale(chart.getY(d,i)))
		.attr("r", (d,i) => chart.plot.options.getSize(d,i))
		.style("fill", (d,i) => chart.plot.options.getColor(d,i))
		.style("opacity", (d,i) => chart.plot.options.getOpacity(d,i));


	    if (typeof chart.settings.clickEvent == "function") {
		plot.selectAll("circle")
		    .on("click", (d, i) => chart.settings.clickEvent(d, i));
	    }
	};

	
	chart.plot.tooltipsHover = function() {	    
	    chart.plot.g.selectAll("circle")
		.on("mouseover", function () {
		    var style = chart.plot.styleProperty;
		    style.r = d3.select(this).attr("r"),
		    style.fill = d3.select(this).style("fill"),
		    style.opacity = d3.select(this).style("opacity");			
		    d3.select(this).attr("r", 8).style("fill", "purple");
		    if(typeof chart.settings.mouseOverEvent == "function") {
			chart.settings.mouseOverEvent(d3.select(this).datum(), style);
		    }
		    
		    var datum = d3.select(this).datum(),
			x = chart.getX(d3.select(this).datum()),
			y = chart.getY(d3.select(this).datum());
		    // var x = chart.xScale.invert(d3.select(this).attr("cx")),
		    // y = chart.yScale.invert(d3.select(this).attr("cy"));
		    
		    chart.objs.tooltip.style("display", null)
			.style("left", (d3.event.pageX+10) + "px")
			.style("top", (d3.event.pageY-28) + "px");
		    
		    tooltipsHover(chart.settings.hoverInfoFormatter(x, y, datum))();
		})
		.on("mouseout", function() {
		    var style = chart.plot.styleProperty;
		    d3.select(this)
			.attr("r", (d,i) => chart.plot.options.getSize(d,i))
			.style("fill", (d, i) => chart.plot.options.getColor(d,i))
			.style("opacity", (d, i) => chart.plot.options.getColor(d,i));
		    if(typeof chart.settings.mouseOutEvent == "function") {
			chart.settings.mouseOutEvent(d3.select(this).datum());
		    }
		    chart.objs.tooltip.style("display", "none");		    
		});
	};
	
	chart.plot.prepare = function () {	    	    
	    chart.plot.g = chart.objs.g.append("g").attr("class", "scatter-plot");
	    chart.plot.g.append("defs").append("clipPath")
		.attr("id", chart.settings.selector.slice(1) + "clip")
		.append("rect")
		.attr("transform", "translate(-8,-8)")
		.attr("width", chart.width+16)
		.attr("height", chart.height+16);	    	    

	    if (chart.settings.brush) {
		chart.plot.brush = d3.brush().extent([[0, 0], [chart.width, chart.height]])
		    .on("end", brushended);
		chart.plot.brushg = chart.plot.g.append("g")
		    .attr("class", "brush")
		    .call(chart.plot.brush);
	    }
	    
	    if (chart.settings.xAxis.zoomX) {
		chart.plot.zoomX = d3.zoom().scaleExtent([1/16, 16])
		    .on("zoom", zoomedX);	    	    	    
		chart.plot.zoomXg = chart.plot.g.append("g")
		    .attr("class", "zoom-x")
		    .attr("transform", "translate(0,"+ (chart.height) + ")")
		    .append("rect")
		    .attr("width", chart.width)
		    .attr("height", chart.margin.bottom)
		    .style("fill", "none")
		    .style("pointer-events", "all")
		    .call(chart.plot.zoomX);
	    }
	    
	    if (chart.settings.yAxis.zoomY) {
		chart.plot.zoomY = d3.zoom().scaleExtent([1/16, 16])
		    .on("zoom", zoomedY);	    
		chart.plot.zoomYg = chart.plot.g.append("g")
		    .attr("class", "zoom-y")
		    .attr("transform", "translate(" + (-chart.margin.left)  +",0)") 
		    .append("rect")
		    .attr("width", chart.margin.left)
		    .attr("height", chart.height)
		    .style("fill", "none")
		    .style("pointer-events", "all")
		    .call(chart.plot.zoomY);
	    }
	    
	};
	
	function brushended() {
	    var s = d3.event.selection;
	    
	    if (!s) {
		if (!idleTimeout)
		    return idleTimeout =  setTimeout(() => {idleTimeout = null;}, idleDelay);
		chart.xScale.domain(chart.xRange0);
		chart.yScale.domain(chart.yRange0);
	    } else {
		var xr = chart.xScale.range(),
		    yr = chart.yScale.range();
		s = s || [[xr[0], yr[0]], [xr[1], yr[1]]];
		chart.xScale.domain(d3.extent([s[0][0], s[1][0]].map(chart.xScale.invert)));
		chart.yScale.domain(d3.extent([s[0][1], s[1][1]].map(chart.yScale.invert)));
		chart.objs.svg.select(".brush").call(chart.plot.brush.move, null);
	    }
	    
	    brush_zoomed(250);
	    
	    var xb = d3.extent(chart.xScale.domain().map(chart.xScale0)),
		yb = d3.extent(chart.yScale.domain().map(chart.yScale0));
	    
	    chart.plot.zoomXg.call(chart.plot.zoomX.transform, d3.zoomIdentity
			.scale(chart.width / (xb[1]-xb[0]))
			.translate(-xb[0], 0));
	    chart.plot.zoomYg.call(chart.plot.zoomY.transform, d3.zoomIdentity
			.scale(chart.height / (yb[1]-yb[0]))
			.translate(0, -yb[0]));
	}
	
	
	function zoomedX() {
	    var t = d3.event.transform;     
	    chart.xScale.domain(d3.extent(t.rescaleX(chart.xScale0).domain()));
	    chart.objs.axis.xAxis.call(chart.objs.xAxis);
	    brush_zoomed(0);
	    var px = chart.xScale.range().map(t.invertX, t),
		py = chart.yScale.range();
	    
	    //chart.plot.brushg.call(chart.plot.brush.move, [px[0], py[0]], [px[1], py[1]]);
	}
	
	function zoomedY() {
	    var t = d3.event.transform;     
	    chart.yScale.domain(d3.extent(t.rescaleY(chart.yScale0).domain()));
	    chart.objs.axis.yAxis.call(chart.objs.yAxis);
	    brush_zoomed(0);
	    var px = chart.xScale.range(),
		py = chart.yScale.range().map(t.invertY, t);
	    
	    //chart.plot.brushg.call(chart.plot.brush.move, [px[0], py[0]], [px[1], py[1]]);
	}
	
	function brush_zoomed(delay) {
	    var t = chart.objs.svg.transition().duration(delay);
	    chart.objs.axis.xAxis.transition(t).call(chart.objs.xAxis);
	    chart.objs.axis.yAxis.transition(t).call(chart.objs.yAxis);
	    chart.plot.g.selectAll("circle").transition(t)
		.attr("cx", d => chart.xScale(chart.getX(d)))
		.attr("cy", d => chart.yScale(chart.getY(d)));
	}
	
	chart.plot.prepare();
	
	chart.plot.update();

	chart.plot.tooltipsHover();
	
	return chart;
	
    };
    
    return chart;
    
}
