function listDistroPlot(settings) {
    var chart = {};
    
    chart.objs = {mainDiv: null, chartDiv: null, g: null, xAxis: null, yAxis: null};
    chart.groupObjs = {};
    chart.groupNames = [];
    chart.colorFunct = null;
    chart.settings = {
	data: null,
	xAxis: {ticks: 10, formatter: null, nFloat: 2},
	nFloat: 2,
	selector: null,
	chartSize: {width: 600, height: 300},
	margin: {left: 40, right: 40, top: 25, bottom: 40},
	bandwidth: 150,
	color: d3.scaleOrdinal(d3.schemeCategory10),
	event: null,
	sliderBrush: true,
	visible: true,
	allObjs: null,
	indexSlide: 0,
	slideChange: true,
	tooltipFunct: undefined,
	labelFunct: undefined
    };

    for (var key in settings) {
        chart.settings[key] = settings[key];
    }
    chart.count = chart.settings.xAxis.ticks;
    chart.allObjs = [];
    chart.slideObjs = [];
    chart.indexSlide = chart.settings.indexSlide;
    
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
	var n = val || chart.settings.nFloat;
	return d => {
	    if (isNaN(d)) return d;
            if (d % 1 !== 0) 
		return d3.format("."+n+"f")(d);
            else
		return d3.format(".0f")(d);
	};
    }
    
    function logFormatNumber(val) {
	var n = val || chart.settings.nFloat;
	return d => {
            var x = Math.log(d) / Math.log(10) + 1e-6;
            return Math.abs(x - Math.floor(x)) < 0.6 ? formatAsFloat(n)(d) : "";
	};
    }

    function getColorFunct(colorOptions) {
        if (typeof colorOptions == 'function') {
            return colorOptions;
        } else if (Array.isArray(colorOptions)) {
            //  If an array is provided, map it to the domain
            var colorMap = {}, cColor = 0;
            for (var cName in chart.groupObjs) {
                colorMap[cName] = colorOptions[cColor];
                cColor = (cColor + 1) % colorOptions.length;
            }
            return function (group) {
                return colorMap[group];
            };
        } else if (typeof colorOptions == 'object') {
            // if an object is provided, assume it maps to  the colors
            return function (group) {
                return colorOptions[group];
            };
        } else {
            return d3.scaleOrdinal(d3.schemeCategory10);
        }
    }


    function getObjWidth(objWidth, gName) {
	var objSize = {left: null, right: null, middle: null};
	var width = chart.xScale.bandwidth() * (objWidth / 100);
	var padding = (chart.xScale.bandwidth() - width) / 2;
	var gShift = chart.xScale(gName);
	objSize.middle = chart.xScale.bandwidth() / 2 + gShift;
	objSize.left = padding + gShift;
	objSize.right = objSize.left + width;
	return objSize;
    }

    function kernelDensityEstimator(kernel, x) {
	return function (sample) {
	    return x.map(function (i) {
		return {x:i, y:d3.mean(sample, v => kernel(i - v) )};
	    });
	};
    }
	
    function eKernel(scale) {
	return function (u) {
	    return Math.abs(u /= scale) <= 1 ? .75 * (1 - u * u) / scale : 0;
	};
    }
		
    // Used to find the roots for adjusting violin axis
    // Given an array, find the value for a single point, even if it is not in the domain
    function eKernelTest(kernel, array) {
	return function (testX) {
	    return d3.mean(array, function (v) {return kernel(testX - v);});
	};
    }
        
    function parseDistroFunct(bandwidth, grid1D) {
	var kde = kernelDensityEstimator(eKernel(bandwidth), grid1D);	
	return (values => kde(values));
    }
    
    function parseMetric(values) {
        var metrics = { //These are the original non-scaled values
	    min: null,
	    lowerOuterFence: null,
	    lowerInnerFence: null,
            quartile1: null,
	    median: null,
            mean: null,
            iqr: null,
            quartile3: null,
            upperInnerFence: null,
            upperOuterFence: null,
            max: null
        };

        metrics.min = d3.min(values);
        metrics.quartile1 = d3.quantile(values, 0.25);
        metrics.median = d3.median(values);
        metrics.mean = d3.mean(values);
        metrics.quartile3 = d3.quantile(values, 0.75);
        metrics.max = d3.max(values);
        metrics.iqr = metrics.quartile3 - metrics.quartile1;
	
        //The inner fences are the closest value to the IQR without going past it (assumes sorted lists)
        var LIF = metrics.quartile1 - (1.5 * metrics.iqr);
        var UIF = metrics.quartile3 + (1.5 * metrics.iqr);
        for (var i = 0; i <= values.length; i++) {
            if (values[i] >= LIF && (!metrics.lowerInnerFence || values[i] < metrics.lowerInnerFence)) {
                metrics.lowerInnerFence = values[i];
            }
            
	    if (values[i] <= UIF && (!metrics.upperInnerFence || values[i] > metrics.upperInnerFence)) {
                metrics.upperInnerFence = values[i];
            }
        }

        metrics.lowerOuterFence = metrics.quartile1 - (3 * metrics.iqr);
        metrics.upperOuterFence = metrics.quartile3 + (3 * metrics.iqr);
        if (!metrics.lowerInnerFence) {
            metrics.lowerInnerFence = metrics.min;
        }
        if (!metrics.upperInnerFence) {
            metrics.upperInnerFence = metrics.max;
        }
        return metrics;
    }

    function calMetricsRange(metrics) {	
	var res = [];
	var keys = ["min", "lowerOuterFence", "lowerInnerFence", "quartile1", "median", "mean", "quartile3", "upperInnerFence", "upperOuterFence", "max"];
	// for (var i=0; i< keys.length; i++) {
	//     if (metrics[keys[i]] !== undefined) 
	// 	res.push(metrics[keys[i]]);
	// }
	// 
	// return d3.extent(res);
	
	res.push(d3.max([metrics["min"], metrics["lowerOuterFence"]]));
	res.push(d3.min([metrics["max"], metrics["upperOuterFence"]]));
	return res;
    }

    function checkMetrics(metrics) {
	var keys = ["min", "lowerOuterFence", "lowerInnerFence", "quartile1", "median", "mean", "iqr", "quartile3", "upperInnerFence", "upperOuterFence", "max"],
	    res = true;
	for (var k of keys) 
	    res &= ((k in metrics) & (metrics[k]!==undefined));
	return res;
    }

    function calDensityRange(kdedata, metrics) {
	var interpolateMax, interpolateMin;
	interpolateMax = d3.min(kdedata.filter(d => (d.x > metrics.max && d.y == 0)), d => d.x);
	interpolateMin = d3.max(kdedata.filter(d => (d.x < metrics.min && d.y == 0)), d => d.x);
    }
    
    function calcOutliers(values, metrics) {
        var extremes = [];
        var outliers = [];
        var val, idx;
        for (idx = 0; idx <= values.length; idx++) {
            val = values[idx];
	    
            if ( val < metrics.lowerInnerFence) {
                if (val < metrics.lowerOuterFence) {
                    extremes.push({value: val});
                } else {
                    outliers.push({value: val});
                }
            } else if (val > metrics.upperInnerFence) {
                if (val > metrics.upperOuterFence) {
                    extremes.push({value: val});
                } else {
                    outliers.push({value: val});
                }
            }
        }

        return {extreme: extremes, outlier: outliers};
    }
        
    function addJitter(doJitter, width) {
        if (doJitter !== true || width == 0) {
            return 0;
        }
        return Math.floor(Math.random() * width) - width / 2;
    }

    function parseData(data) {
	for (var cName in data) {
	    chart.groupObjs[cName] = {};
	    chart.groupObjs[cName].visible = (data[cName].visible !== undefined) ? data[cName].visible : chart.settings.visible;
	    if (("metrics" in data[cName])) {
		chart.groupObjs[cName].metrics = data[cName].metrics;
	    } else {
		if ("values" in data[cName])
		    chart.groupObjs[cName].metrics = parseMetric(data[cName].values);
	    }
	    
	    chart.groupObjs[cName].info = data[cName].info;
	    
	    if (("metrics" in chart.groupObjs[cName]) || ("kdedata" in data[cName])) {
		chart.allObjs.push(cName);
		chart.groupObjs[cName].scale = d3.scaleLinear();
		if ("domain" in data[cName]) {
		    chart.groupObjs[cName].domain = data[cName].domain;
		} else {
		    if ("metrics" in chart.groupObjs[cName])
			chart.groupObjs[cName].domain = calMetricsRange(chart.groupObjs[cName].metrics);
		    else if ("kdedata" in data[cName]) 
			chart.groupObjs[cName].domain = d3.extent(data[cName].kdedata.x);
		}
		chart.groupObjs[cName].scale.domain(chart.groupObjs[cName].domain).range([chart.height, 0]).clamp(true);
		chart.groupObjs[cName].niceScale = chart.groupObjs[cName].scale.copy().nice();
		chart.groupObjs[cName].value = data[cName].value || chart.groupObjs[cName].metrics.median;
		chart.groupObjs[cName].defaultValue = chart.groupObjs[cName].value;
	    }
	    
	    if ("kdedata" in data[cName]) {
		chart.groupObjs[cName].kdedata = data[cName].kdedata;
	    } else {
		if ("values" in data[cName]) {
		    var domain = chart.groupObjs[cName].domain;
		    var resolution = Math.abs(domain[1] - domain[0])/64.0;
		    var kde = parseDistroFunct(resolution, chart.groupObjs[cName].scale.ticks(128)); 
		    chart.groupObjs[cName].kdedata = kde(data[cName].values);
		}
	    }
	    
	    if ("outliers" in data[cName]) {
		chart.groupObjs[cName].outliers = data.outliers;
	    } else {
		if (("metrics" in chart.groupObjs[cName]) || ("values" in data[cName])) {
		    chart.groupObjs[cName].outliers = calcOutliers(data[cName].values, chart.groupObjs[cName].metrics);
		}
	    }
	}
	
    }
    
    
    !function prepareSettings() {
	chart.margin = chart.settings.margin;
	chart.divWidth = chart.settings.chartSize.width;
        chart.divHeight = chart.settings.chartSize.height;
	chart.width = chart.divWidth - chart.margin.left - chart.margin.right;
	chart.height = chart.divHeight - chart.margin.top - chart.margin.bottom;	
	
	chart.bandwidth = chart.settings.bandwidth;	
	chart.colorFunct = getColorFunct(chart.settings.colors);
	
	parseData(chart.settings.data);
	
	if (chart.settings.allObjs)
	    chart.allObjs = chart.settings.allObjs;

	chart.slideObjs = chart.allObjs.slice(chart.indexSlide*chart.count, (chart.indexSlide+1)*chart.count);

	if (chart.settings.xAxis.label) {
            chart.xAxisLable = chart.settings.xAxis.label;
        } else {
            chart.xAxisLable = chart.settings.xName;
        }
	
	chart.xScale = d3.scaleBand();
	chart.xFormatter = (typeof chart.settings.xAxis.formatter == "function") ? chart.settings.xAxis.formatter : formatAsFloat(chart.settings.xAxis.nFloat);
	
	var width = chart.width * chart.slideObjs.length/chart.count,
	    start = (chart.width - width)/2;
	chart.xScale.domain(chart.slideObjs).range([start, start + width]);
	// chart.xScale.domain(chart.slideObjs).range([0, chart.width]);
	
	chart.objs.xAxis = d3.axisBottom(chart.xScale).tickFormat(chart.xFormatter)
	    .ticks(chart.settings.xAxis.ticks);
	
    }();
    
    chart.updateEnv = function(opts) {

    };

    var labelFunct = function(x) {
	if(typeof chart.settings.labelFunct == "function") 
	    return chart.settings.labelFunct(x);
	else if (typeof chart.settings.labelFunct == "object")
	    return  chart.settings.labelFunct[x] || "-";
	else
	    return x;
    };
    
    function tooltipsText(name) {
	var r = name.split("-");
	var label = labelFunct(name);
	if (name.includes("grade"))
	    return label;
	else
	    return label + " in chapter " + r[0];
    }

    function tooltipsName(name) {
	if (typeof chart.settings.tooltipFunct == "function")
	    return chart.settings.tooltipFunct(name);
	else if (typeof chart.settings.tooltipFunct == 'object')
	    return chart.settings.tooltipFunct[name] || "-";
	else
	    return tooltipsText(name);	
    }

    function tooltipsHover(name, metrics) {
	var formatter =  formatAsFloat();
        var tooltipString = "<fieldset>";
	tooltipString += "<legend> " + tooltipsText(name) + "</legend>";
	tooltipString += "Description: " + tooltipsName(name);
        tooltipString += "<br\>Max: " + formatter(metrics.max);
        tooltipString += "<br\>Q3: " + formatter(metrics.quartile3);
        tooltipString += "<br\>Median: " + formatter(metrics.median);
        tooltipString += "<br\>Q1: " + formatter(metrics.quartile1);
        tooltipString += "<br\>Min: " + formatter(metrics.min);
	tooltipString += "</fieldset>";
        return function () {
            chart.objs.tooltip.transition().duration(200).style("opacity", 0.9);
            chart.objs.tooltip.html(tooltipString);
        };
    }

    function registerHover() {
	for (var cName of chart.slideObjs) {
            chart.groupObjs[cName].g.on("mouseover", function () {                
                chart.objs.tooltip
                    .style("display", null)
		    .style("width", "300px")
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            }).on("mouseout", function () {
                chart.objs.tooltip.style("display", "none");
            }).on("mousemove", tooltipsHover(cName, chart.groupObjs[cName].metrics));
	}
    }
        
    !function prepareChart(info) {
	// Build main div and chart div
        chart.objs.mainDiv = d3.select(chart.settings.selector)
            .style("max-width", chart.divWidth + "px");
	// Add all the divs to make it centered and responsive
        chart.objs.innerDiv = chart.objs.mainDiv.append("div")
            .attr("class", "inner-wrapper");
        //.style("padding-bottom", (chart.divHeight / chart.divWidth) * 100 + "%");
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
	    .attr("class", "chart")
            .attr("transform", "translate(" + chart.margin.left + "," + chart.margin.top + ")");
	
	// Create axis
	chart.objs.axis = {xAxis: null,  xLabel: null, g: null};
        chart.objs.axis.g = chart.objs.g.append("g").attr("class", "axis");

	chart.objs.axis.frame = chart.objs.axis.g.append("g")
	    .attr("class", "axis-frame")
	    .attr("transform", "translate(0," + (chart.height+7.5) + ")")
	    .append("rect")
	    .attr("fill", "none")
	    .attr("height", chart.margin.bottom-7.5)
	    .attr("width", chart.width);
	
	// chart.objs.axis.xAxis = chart.objs.axis.g.append("g")
        //     .attr("class", "axis axis-x")
        //     .attr("transform", "translate(0," + chart.height + ")")	
        //     .call(chart.objs.xAxis);
	
	// chart.objs.axis.xLabel = chart.objs.axis.g.append("g")
	//     .attr("class", "x-label")
	//     .attr("transform", "translate(0," + chart.height + ")")
	//     .append('text')
	//     .attr("x", chart.width/2)
	//     .attr('dy', "2.2em")
	//     .attr("text-anchor", "middle")
	//     .text(chart.xAxisLable);
	
	if (chart.settings.slideChange) {
	    chart.objs.prev = chart.objs.chartDiv.select("svg")
		.append("a")
		.attr("class", "prev");
	    chart.objs.prev.append("rect")
		.attr("x", 0)
		.attr("y", chart.margin.top+chart.height*0.5-chart.margin.left*0.5)
		.attr("width", chart.margin.left)
		.attr("height", chart.margin.left);
	    chart.objs.prev.insert("text")
		.attr("x", chart.margin.left*0.5)
		.attr("y", chart.margin.top+chart.height*0.5+8)
		.attr("font-size", "18px")
		.attr("text-anchor", "middle")
		.html("&#10094;");

	    chart.objs.next = chart.objs.chartDiv.select("svg")
		.append("a")
		.attr("class", "next");
	    chart.objs.next.append("rect")
		.attr("x", chart.margin.left+chart.width)
		.attr("y", chart.margin.top+chart.height*0.5-chart.margin.right*0.5)
		.attr("width", chart.margin.right)
		.attr("height", chart.margin.right);
	    
	    chart.objs.next.insert("text")
		.attr("x", chart.margin.left+chart.width+chart.margin.right*0.5)
		.attr("y", chart.margin.top+chart.height*0.5+8)
		.attr("font-size", "18px")
		.attr("text-anchor", "middle")
		.html("&#10095;");
	    
	    chart.objs.next.on("click", nextSlideTranslation);
	    chart.objs.prev.on("click", prevSlideTranslation);
	}

	chart.objs.tooltip = chart.objs.mainDiv.append('div').attr('class', 'tooltip');
	for (var cName in chart.groupObjs) {
	    chart.groupObjs[cName].g = chart.objs.g.append("g").attr("class", "group " + cName);
	}
	
	registerHover();
	
    }();


    function nextSlideTranslation() {
	var numSlide = Math.ceil(chart.allObjs.length/chart.count);
	var curr = chart.indexSlide;
	var next = chart.indexSlide+1;
	next = next >= numSlide ? 0 : next;
	if (next !== curr) 
	    slideTranslation(next);
	
    }


    function prevSlideTranslation() {
	var numSlide = Math.ceil(chart.allObjs.length/chart.count);
	var curr = chart.indexSlide;
	var prev = chart.indexSlide-1;
	prev = prev < 0 ? (numSlide-1) : prev;
	if (prev !== curr) 
	    slideTranslation(prev);	    	
	
    }

    function slideTranslation (index) {	
	chart.violin.removeAll();
	chart.box.removeAll();
	chart.bar.removeAll();
	
	
	
	chart.indexSlide = index;
	chart.slideObjs = chart.allObjs.slice(index*chart.count, (index+1) *chart.count);
	
	var width = chart.width * chart.slideObjs.length/chart.count,
	    start = (chart.width - width)/2;
	chart.xScale.domain(chart.slideObjs).range([start, start + width]);
	
	chart.violin.change();
	chart.box.change();
	chart.bar.change();
	
	registerHover();
    };    
    
    
    chart.updateObjs = function (allObjs, index, count) {
	chart.violin.removeAll();
	chart.box.removeAll();
	chart.bar.removeAll();

	
	chart.allObjs = allObjs;
	chart.indexSlide = index || 0;
	chart.count = count || chart.count;
	chart.slideObjs = chart.allObjs.slice(chart.indexSlide*chart.count, (chart.indexSlide+1) *chart.count);
	
	var width = chart.width * chart.slideObjs.length/chart.count,
	    start = (chart.width - width)/2;
	chart.xScale.domain(chart.slideObjs).range([start, start + width]);
	
	chart.violin.change();
	chart.box.change();
	chart.bar.change();
	
	registerHover();
    };
    
    chart.renderViolinPlot = function (options) {
	chart.violin = {};
	var defaultOptions = {
	    colors: chart.colorFunct	    
	};
	chart.violin.options = shallowCopy(defaultOptions);
	for (var key in options) {
	    chart.violin.options[key] = options[key];
	}
	var vOpts = chart.violin.options;
	chart.violin.colorFunct = getColorFunct(chart.violin.options.colors);
	
	
	chart.violin.updateData = function(opts) {
	    if (opts.data !== undefined) {
		chart.settings.data = opts.data;
		chart.violin.remove();
	    }
	    
	    chart.updateEnv(opts);   
	    chart.violin.reset();
	};
	
	chart.violin.change = function(updateOptions) {
	    if (updateOptions) {
                for (var key in updateOptions) {
                    vOpts[key] = updateOptions[key];
                }
            }
            chart.violin.prepare();
            chart.violin.update();
	};
	
	chart.violin.reset = function() {
	    chart.violin.change(defaultOptions);
	};
	
	chart.violin.show = function(opts) {
	    if (opts !== undefined) {
                opts.show = true;
                if (opts.reset) {
                    chart.violin.reset();
                }
            } else {
                opts = {show: true};
            }
            chart.violin.change(opts);
	};
	
	chart.violin.hide = function(opts) {
	    if (opts !== undefined) {
                opts.show = false;
                if (opts.reset) {
                    chart.violin.reset();
                }
            } else {
                opts = {show: false};
            }
            chart.violin.change(opts);
	};
	
	chart.violin.remove = function(cName) {
	    chart.groupObjs[cName].g.select(".violin-plot").remove();
	};
	
	chart.violin.removeAll = function() {
	    for (var cName of chart.allObjs)
		chart.violin.remove(cName);
	};
	
	chart.violin.update = function() {
	    var violin, kdedata;
	    
	    var resolution = 200,
		interpolation = d3.curveCardinal;
	    
	    for (var cName of chart.slideObjs) {	
		if (chart.groupObjs[cName].visible == false) continue;	
		violin = chart.groupObjs[cName].violin;
		
		var xVScale = chart.groupObjs[cName].niceScale.copy();
		var objBounds = getObjWidth(80, cName);
		var bandwidth = (objBounds.right - objBounds.left)/2;
		
		if (chart.groupObjs[cName].kdedata !== undefined)
		    kdedata = chart.groupObjs[cName].kdedata;
		else {
		    var kde = parseDistroFunct(80, chart.groupObjs[cName].scale.ticks(200)); 
		    kdedata = kde(chart.groupObjsdata[cName].values);
		    chart.groupObjs[cName].kdedata = kdedata;
		}
		
		var yVScale = d3.scaleLinear()
			.range([bandwidth, 0])
			.domain([0, d3.max(kdedata, d => d.y)])
			.nice()
			.clamp(true);

		 var area = d3.area()
			 .curve(interpolation)
			 .x(d => xVScale(d.x))
			 .y0(bandwidth)
			 .y1(d => yVScale(d.y));
		
		 var line = d3.line()
			 .curve(interpolation)
			 .x(d => xVScale(d.x))
			 .y(d => yVScale(d.y));
		
		violin.objs.left.area.datum(kdedata).attr("d", area);
		violin.objs.right.area.datum(kdedata).attr("d", area);
		
		violin.objs.left.line.datum(kdedata).attr("d", line);
		violin.objs.right.line.datum(kdedata).attr("d", line);

		var transformLeft = "rotate(90,0,0) translate(0," + (-objBounds.left) + ") scale(1,-1)",
		    transformRight = "rotate(90,0,0) translate(0," + (-objBounds.right) + ")",
		    transformCenter = "rotate(90,0,0) translate(0," + (-objBounds.middle) + ")";
		
		violin.objs.left.g.attr("transform",  transformLeft);
		violin.objs.right.g.attr("transform", transformRight);		
	    }

	};

	chart.violin.prepare = function() {
	    var violin;

	    for (var cName of chart.slideObjs) {
		if (chart.groupObjs[cName].visible == false) continue;
		
		if (chart.groupObjs[cName].violin == undefined) {
		    chart.groupObjs[cName].violin = {};
		    chart.groupObjs[cName].violin.objs = {};
		}		
		violin = chart.groupObjs[cName].violin;
		violin.objs.g = chart.groupObjs[cName].g.append("g").attr("class", "violin-plot");
		
		violin.objs.left = {area: null, line: null, g: null};
                violin.objs.right = {area: null, line: null, g: null};

                violin.objs.left.g = violin.objs.g.append("g").attr("class", "left");
                violin.objs.right.g = violin.objs.g.append("g").attr("class", "right");

                if (vOpts.showViolinPlot !== false) {
                    // Area
                    violin.objs.left.area = violin.objs.left.g.append("path")
                        .attr("class", "area")
                        .style("fill", chart.violin.colorFunct(cName));
                    violin.objs.right.area = violin.objs.right.g.append("path")
                        .attr("class", "area")
                        .style("fill", chart.violin.colorFunct(cName));

                    // Lines
                    violin.objs.left.line = violin.objs.left.g.append("path")
                        .attr("class", "line")
                        .attr("fill", 'none')
                        .style("stroke", chart.violin.colorFunct(cName));
                    violin.objs.right.line = violin.objs.right.g.append("path")
                        .attr("class", "line")
                        .attr("fill", 'none')
                        .style("stroke", chart.violin.colorFunct(cName));
                }
	    }
	};
	
	chart.violin.prepare();
	
	chart.violin.update();

	return chart;
    };

    chart.renderBoxPlot = function (options) {
	chart.box = {};
	
	var defaultOptions = {
	    show: true,
            showBox: true,
            showWhiskers: true,
            showMedian: true,
            showMean: true,
            medianCSize: 3.5,
            showOutliers: false,
            boxWidth: 30,
            lineWidth: null,
            scatterOutliers: false,
            outlierCSize: 2.5,
            colors: chart.colorFunct
	};
	chart.box.options = shallowCopy(defaultOptions);
	for (var key in options) {
	    chart.box.options[key] = options[key];
	}		
	var bOpts = chart.box.options;
	chart.box.colorFunct = getColorFunct(chart.box.options.colors);
	
	
	chart.box.updateData = function(opts) {
	    if (opts.data !== undefined) {
		chart.settings.data = opts.data;
		chart.box.remove();
	    }
	    
	    chart.updateEnv(opts);	    	    
	    chart.box.reset();	    
	};

	chart.box.change = function(updateOptions) {
	    if (updateOptions) {
                for (var key in updateOptions) {
                    bOpts[key] = updateOptions[key];
                }
            }
            chart.box.prepare();
            chart.box.update();
	};
	
	chart.box.reset = function() {
	    chart.box.change(defaultOptions);
	};
	
	chart.box.show = function(opts) {
	    if (opts !== undefined) {
                opts.show = true;
                if (opts.reset) {
                    chart.box.reset();
                }
            } else {
                opts = {show: true};
            }
            chart.box.change(opts);
	};
	
	chart.box.hide = function(opts) {
	     if (opts !== undefined) {
                opts.show = false;
                if (opts.reset) {
                    chart.box.reset();
                }
            } else {
                opts = {show: false};
            }
            chart.box.change(opts);
	};
	
	chart.box.remove = function(cName) {
	    chart.groupObjs[cName].g.select(".box-plot").remove();
	};
	
	chart.box.removeAll = function() {
	    for (var cName of chart.allObjs)
		chart.box.remove(cName);
	};
	
	chart.box.update = function() {
	    var box;
	    
	    for (var cName of chart.slideObjs) {
		if (chart.groupObjs[cName].visible == false) continue;
		box = chart.groupObjs[cName].box;
		
		var xVScale = chart.groupObjs[cName].niceScale.copy();
		var objBounds = getObjWidth(bOpts.boxWidth, cName);
		var bandwidth = (objBounds.right - objBounds.left)/2;
		var metrics = chart.groupObjs[cName].metrics;
		var outliers = chart.groupObjs[cName].outliers.outliers;
		var extremes = chart.groupObjs[cName].outliers.extremes;
		
		if (box.objs.box) {
                    box.objs.box
                        .attr("x", objBounds.left)
                        .attr('width', bandwidth*2)
                        .attr("y", xVScale(metrics.quartile3))
                        .attr("rx", 1)
                        .attr("ry", 1)
                        .attr("height", () => -xVScale(metrics.quartile3)+xVScale(metrics.quartile1));
		};
		
		var lineBounds = null;
		if (bOpts.lineWidth) {
		    lineBounds = getObjWidth(bOpts.lineWidth, cName);
		} else {
		    lineBounds = objBounds;
		}

		if (box.objs.upperWhisker) {
		    box.objs.upperWhisker.fence
                        .attr("x1", lineBounds.left)
                        .attr("x2", lineBounds.right)
                        .attr('y1', xVScale(metrics.upperInnerFence))
                        .attr("y2", xVScale(metrics.upperInnerFence));
		    
                    box.objs.upperWhisker.line
                        .attr("x1", lineBounds.middle)
                        .attr("x2", lineBounds.middle)
                        .attr('y1', xVScale(metrics.quartile3))
                        .attr("y2", xVScale(metrics.upperInnerFence));
		}
		if (box.objs.lowerWhisker) {
                    box.objs.lowerWhisker.fence
                        .attr("x1", lineBounds.left)
                        .attr("x2", lineBounds.right)
                        .attr('y1', xVScale(metrics.lowerInnerFence))
                        .attr("y2", xVScale(metrics.lowerInnerFence));
                    box.objs.lowerWhisker.line
                        .attr("x1", lineBounds.middle)
                        .attr("x2", lineBounds.middle)
                        .attr('y1', xVScale(metrics.quartile1))
                        .attr("y2", xVScale(metrics.lowerInnerFence));
                }

		if (box.objs.median) {
                    box.objs.median.line
                        .attr("x1", lineBounds.left)
                        .attr("x2", lineBounds.right)
                        .attr('y1', xVScale(metrics.median))
                        .attr("y2", xVScale(metrics.median));
                    box.objs.median.circle
                        .attr("cx", lineBounds.middle)
                        .attr("cy", xVScale(metrics.median));
                }

                if (box.objs.mean) {
                    box.objs.mean.line
                        .attr("x1", lineBounds.left)
                        .attr("x2", lineBounds.right)
                        .attr('y1', xVScale(metrics.mean))
                        .attr("y2", xVScale(metrics.mean));
                    box.objs.mean.circle
                        .attr("cx", lineBounds.middle)
                        .attr("cy", xVScale(metrics.mean));
                }

		if (box.objs.outliers) {
                    for (var pt in outliers) {
                        box.objs.outliers[pt].point
                            .attr("cx", objBounds.middle + addJitter(bOpts.scatterOutliers, bandwidth*2))
                            .attr("cy", xVScale(outliers[pt].value));
                    }
                }
                if (box.objs.extremes) {
                    for (var pt in extremes) {
                        box.objs.extremes[pt].point
                            .attr("cx", objBounds.middle + addJitter(bOpts.scatterOutliers, bandwidth*2))
                            .attr("cy", xVScale(extremes[pt].value));
                    }
                }
	    }
	};

	chart.box.prepare = function() {
	    var box;
	    
	    for (var cName of chart.slideObjs) {
		
		if (chart.groupObjs[cName].visible == false) continue;
		
		if (chart.groupObjs[cName].box == undefined) {
		    chart.groupObjs[cName].box = {};
		    chart.groupObjs[cName].box.objs = {};
		}
		box = chart.groupObjs[cName].box;		
		box.objs.g = chart.groupObjs[cName].g.append("g").attr("class", "box-plot");
		
		if (bOpts.showBox) {
		    box.objs.box = box.objs.g.append("rect")
			.attr("class", "box")
			.style("fill", chart.box.colorFunct(cName))
			.style("stroke", chart.box.colorFunct(cName));
		}

		if (bOpts.showMedian) {
		    box.objs.median = {line: null, circle: null};
		    box.objs.median.line = box.objs.g.append("line")
			.attr("class", "median");
		    box.objs.median.circle = box.objs.g.append("circle")
			.attr("class", "median")
			.attr("r", bOpts.medianCSize)
			.style("fill", chart.box.colorFunct(cName));
		}

		if (bOpts.showMean) {
		    box.objs.mean = {line: null, circle: null};
		    box.objs.mean.line = box.objs.g.append("line")
			.attr("class", "mean");
		    box.objs.mean.circle = box.objs.g.append("circle")
                        .attr("class", "mean")
			.attr("r", bOpts.medianCSize)
			.style("fill", chart.box.colorFunct(cName));		    
		}
		
		if (bOpts.showWhiskers) {
		    box.objs.upperWhisker = {fence: null, line: null};
		    box.objs.lowerWhisker = {fence: null, line: null};
                    box.objs.upperWhisker.fence = box.objs.g.append("line")
                        .attr("class", "upper whisker")
                        .style("stroke", chart.box.colorFunct(cName));
                    box.objs.upperWhisker.line = box.objs.g.append("line")
                        .attr("class", "upper whisker")
                        .style("stroke", chart.box.colorFunct(cName));

                    box.objs.lowerWhisker.fence = box.objs.g.append("line")
                        .attr("class", "lower whisker")
                        .style("stroke", chart.box.colorFunct(cName));
                    box.objs.lowerWhisker.line = box.objs.g.append("line")
                        .attr("class", "lower whisker")
                        .style("stroke", chart.box.colorFunct(cName));
                }

		if (bOpts.showOutliers) {
		    var outliers = chart.groupObjs[cName].outliers.outliers;
		    var extremes = chart.groupObjs[cName].outliers.extremes;
                    if (outliers.length) {
                        var outDiv = box.objs.g.append("g").attr("class", "boxplot outliers");
                        for (var pt in outliers) {
                            box.objs.outliers[pt].point = outDiv.append("circle")
				.attr("class", "outlier")
                                .attr('r', bOpts.outlierCSize)
                                .style("fill", chart.box.colorFunct(cName));
                        }
                    }
		    
                    if (extremes.length) {
                        var extDiv = box.objs.g.append("g").attr("class", "boxplot extremes");
                        for (var pt in box.objs.extremes) {
			    box.objs.extremes[pt].point = extDiv.append("circle")
                                .attr("class", "extreme")
                                .attr('r', bOpts.outlierCSize)
                                .style("stroke", chart.box.colorFunct(cName));
                        }
                    }
                }

	    }
	};

	chart.box.prepare();

	chart.box.update();

	return chart;
    };

    
    chart.renderSliderBar = function (options) {
	chart.bar = {};
	
	var defaultOptions = {
	    show: true,
	    remove: false,
	    colors: ["red"],
	    ldl: 20,
	    dl: 35,
	    nFloat: 2,
	    labelFunct: undefined,
	    textFunct: undefined
        };
	
	chart.bar.options = shallowCopy(defaultOptions);
	for (var key in options) {
	    chart.bar.options[key] = options[key];
	}

	var barLabelFunct =  function (x) {
	    if(typeof chart.bar.options.labelFunct == "function") {
		return chart.bar.options.labelFunct(x);
	    } else {
		return labelFunct(x);
	    }
	};
	
	var bOpts = chart.bar.options;
	chart.bar.colorFunct = getColorFunct(chart.bar.options.colors);	

	chart.bar.change = function(updateOptions) {
	    if (updateOptions) {
                for (var key in updateOptions) {
                    bOpts[key] = updateOptions[key];
                }
            }
            chart.bar.prepare();
            chart.bar.update();
	};
	
	chart.bar.reset = function() {
	    chart.bar.change(defaultOptions);
	};
	
	chart.bar.show = function(opts) {
	    if (opts !== undefined) {
                opts.show = true;
                if (opts.reset) {
                    chart.bar.reset();
                }
            } else {
                opts = {show: true};
            }
            chart.bar.change(opts);
	};
	
	chart.bar.hide = function(opts) {
	    if (opts !== undefined) {
                opts.show = false;
                if (opts.reset) {
                    chart.bar.reset();
                }
            } else {
                opts = {show: false};
            }
            chart.bar.change(opts);
	};	
	
	chart.bar.remove = function(cName) {
	    chart.groupObjs[cName].g.select(".slider-bar").remove();
	};
	
	chart.bar.removeAll = function() {
	    for (var cName of chart.allObjs)
		chart.bar.remove(cName);
	};
	
	
	chart.bar.update = function() {
	    var bar;

	    for (var cName of chart.slideObjs) {
		bar = chart.groupObjs[cName].bar;
		
		var objBounds = getObjWidth(bOpts.boxWidth, cName);
		var transform_x = "translate(" + (objBounds.middle) + " ,0)";

		bar.objs.g.attr("transform", transform_x);
	    }
	};
	
	chart.bar.prepare = function() {
	    var bar;
	    
	    for (var cName of chart.slideObjs) {
		if (chart.groupObjs[cName].bar == undefined) {		    
		    chart.groupObjs[cName].bar  = {};
		    chart.groupObjs[cName].bar.objs = {};
		}
		bar = chart.groupObjs[cName].bar;
		bar.objs.g = chart.groupObjs[cName].g.append("g").attr("class", "slider-bar");
		
		if (bar.slider == undefined) {
		    bar.slider = new slider();
		    if (chart.groupObjs[cName].value == undefined) {
			chart.groupObjs[cName].value = chart.groupObjs[cName].metrics.median;
		    }

		    let gObjs = chart.groupObjs[cName];			    
		    bar.slider.width(chart.height)	
			.vertical(true)
			.dl(chart.height + bOpts.dl)
			.label(barLabelFunct(cName))
			.ldl(chart.height + bOpts.ldl)
			.nFloat(chart.bar.options.nFloat)
			.scale(gObjs.niceScale)
			.event((val) => {
			    gObjs.value = val;
			});
		    
		    bar.slider.brush(chart.groupObjs[cName].visible && chart.settings.sliderBrush);
		    if (typeof chart.bar.options.textFunct === "function") {
			bar.slider.text(chart.bar.options.textFunct);
		    }
		}
		
		bar.slider.defaultPos(chart.groupObjs[cName].defaultValue);
		bar.slider.pos(chart.groupObjs[cName].value);
		bar.slider.info(chart.groupObjs[cName].info);
		
		if (bOpts.show) {
		    bar.objs.g.call(bar.slider);
		}
	    }
	};
	
	chart.bar.prepare();
	chart.bar.update();
	
	return chart;
    };
    
    
    return chart;
}
