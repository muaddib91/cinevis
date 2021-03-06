/*
  TODO LIST
  * fix colorlegend story - use two rows
  * format colorlegend values
  * use nice values for colorlegend numeric scales
  * tick scale always uses intFormat
  * Paranormal activity throws off everything in profitability
  * reset filters when changing axes - something like
     d3.selectAll('circle').each(function(d) {d.display = true;});
*/

// ensure that all transitions are on the same timing
var TRANSITION_DURATION = 2500;

// axes: by default, x = budget, y = gross
var xField = 'Budget',
    yField = 'Worldwide Gross';
var xScale, yScale,
    xAxis, yAxis,
    xAxisPanel, yAxisPanel,
    xLegend, yLegend;

// build the array of filters to be populated when filters are set
var allFilters = [];
$.each(['Profitability', 'Budget', 'Worldwide Gross', 'Domestic Gross', 'Foreign Gross', 'Audience Rating', 'Critic Rating'], function(index, value) {
  allFilters.push( {field: value, min:-1, max:-1} );
});

// color scales
var genreColorScale = d3.scale.category20();

var storyColorScale = d3.scale.ordinal().range([
    'rgb(127,85,49)', 'rgb(152,202,150)', 'rgb(72,173,99)', 'rgb(152,202,150)',
    'rgb(44,169,156)', 'rgb(129,30,86)', 'rgb(76,77,77)', 'rgb(217,39,49)',
    'rgb(217,206,177)', 'rgb(121,184,86)', 'rgb(193,71,53)', 'rgb(144,45,43)',
    'rgb(104,50,121)', 'rgb(163,208,196)', 'rgb(97,99,99)', 'rgb(209,159,140)',
    'rgb(202,204,203)', 'rgb(164,88,139)', 'rgb(174,155,73)', 'rgb(718,25,64)',
    'rgb(223,74,132)', 'rgb(57,74,136)', 'rgb(240,240,240)', 'rgb(163,208,196)'
    ]).domain([
    'discovery', 'love', 'rivalry', 'quest', 'comedy', 'escape', 'metamorphosis',
    'monster force', 'fish out of water', 'revenge', 'maturation', 'underdog',
    'sacrifice', 'the riddle', 'wretched excess', 'temptation', 
    'journey and return', 'pursuit', 'transformation', 'tragedy', 'rescue', 
    'rags to riches', '']);
// red - gray - blue [min - avg - max]
var quantileColorScale = [
    'rgb(103, 0, 31)', 'rgb( 178, 24, 43)', 'rgb( 214, 96, 77)', 'rgb( 244, 165, 130)', 
    'rgb( 220, 220, 220)',
    'rgb( 146, 197, 222)', 'rgb( 67, 147, 195)', 'rgb( 33, 102, 172)', 'rgb( 5, 48, 97)'
      ];

// must set domain of numeric scale: domain([minVal, maxVal])
var numericColorScale = d3.scale.quantile().range(quantileColorScale);
// default to story for color
var colorField = 'Story';
var colorScale = storyColorScale;


var data;     // the main film data structure
var averages; // {year: {field: avg,..}, ..}
var svg;

// format functions
var numberFormat = d3.format(',.2f');
var intFormat = d3.format(',');
var percentFormat = d3.format(',%');

// getter/setter for domain (min/max) of a given data field
//   axis = 'x' or 'y', field is the data field to find the domain for
//   optional arguments: min, max - if set use those rather than figure out
var domain = function(axis, field, min, max) {
  var dmn = [];
  if ( arguments.length === 4 ) {
    dmn = [min,max];
  }
  else if ( arguments.length === 2 ) {
    dmn = [ d3.min(data, function(d) { return $.isNumeric(d[field]) ? +d[field] : 0; }), d3.max(data, function(d) { return $.isNumeric(d[field]) ? +d[field] : 0; }) ];
    // log scales cannot have a 0, so increase the min/max if necessary
    dmn[0] === 0 ? dmn[0] = 1 : null;
    dmn[1] === 0 ? dmn[1] = 1 : null;
  }
  if ( arguments.length > 1 ) {
    axis === 'x' ? this.xDomain = dmn : this.yDomain = dmn;
  }
  return axis === 'x' ? this.xDomain : this.yDomain;
};

// getter/setter for range (min/max) of a given scale
var range = function(axis, min, max) {
  if ( arguments.length > 1 ) {
    axis === 'x' ? this.xRange = [min, max] : this.yRange = [min, max];
  }
  return axis === 'x' ? this.xRange : this.yRange;
}

// getter/setter for the axis
//  for now this just gets/sets the axis type ('log' or 'linear')
var axisType = function(axis, type) {
  if ( arguments.length > 1 ) {
    axis === 'x' ? this.xType = type : this.yType = type;
  }
  return axis === 'x' ? this.xType : this.yType;
}

// return the value for a given scale, checking if it is a number
// d = the data item to locate, axis = 'x' or 'y'
var locate = function(d, axis) {
  var datum, scale;
  if ( axis === 'x' ) {
    datum = d[xField];
    scale = xScale;
  }
  else {
    datum = d[yField];
    scale = yScale;
  }
  // set to minimum of domain for non-numeric values
  if ( ! $.isNumeric(datum) ) {
    return domain(axis)[0];
  }
  // return the scaled value, unless it would be zero for log scales
  // log(0) is negative infinity
  else {
    var scaledVal = scale(datum);
    return ! $.isNumeric(scaledVal) ? domain(axis)[0] : scaledVal;
  }
};

// return the color based on the current scale
// d = the data item to colorize
var colorize = function(d) {
  if ( colorField === 'None' ) {
    return null;
  }
  else if ( colorField === 'Story' || colorField === 'Genre' ) {
    return colorScale(d[colorField].toLowerCase());
  }
  else {
    return colorScale(+d[colorField]);
  }
};

// load the data asynchronously
d3.json('data/moviedata.json', function(json) {
  data = json;

  setupSliders('#profit-slider', '#profit-slider-text', percentFormat, 'Profitability');
  setupSliders('#budget-slider', '#budget-slider-text', intFormat, 'Budget', {prepend:'$', append:' M'});
  setupSliders('#wgross-slider', '#wgross-slider-text', intFormat, 'Worldwide Gross', {prepend:'$', append:' M'});
  setupSliders('#dgross-slider', '#dgross-slider-text', intFormat, 'Domestic Gross', {prepend:'$', append:' M'});
  setupSliders('#fgross-slider', '#fgross-slider-text', intFormat, 'Foreign Gross', {prepend:'$', append:' M'});
  setupSliders('#arating-slider', '#arating-slider-text', intFormat, 'Audience Rating', {min:0, max:100, append:'%'});
  setupSliders('#crating-slider', '#crating-slider-text', intFormat, 'Critic Rating', {min:0, max:100, append:'%'});

  // set controls to be defaults
  $('#xaxis').val(xField);
  $('#yaxis').val(yField);
  $('#color').val(colorField);


  var w = $('#vispanel').width(),
      h = $('#vispanel').height();

  var axisPadding = 54; // for padding on the axis side
  var padding = 10;     // for padding opposite side of axis

  domain('x', xField);
  range('x', 0, w - axisPadding);
  domain('y', yField);
  range('y', h - axisPadding, 0);

  // set up color legend
  colorlegend('#colorpanel', colorScale, 'ordinal', {fill: true});
  
  axisType('x', 'linear');
  xScale = d3.scale.linear()
    .domain(domain('x'))
    .range(range('x'))
    .nice();
  axisType('y', 'linear');
  yScale = d3.scale.linear()
    .domain(domain('y'))
    .range(range('y'))
    .nice();

  xAxis = d3.svg.axis()
    .scale(xScale)
    .orient('bottom')
    .ticks(5)
    .tickSize(-(h-axisPadding), 0, 0)
    .tickFormat(intFormat);
  yAxis = d3.svg.axis()
    .orient('left')
    .scale(yScale)
    .ticks(5)
    .tickSize(-(w-axisPadding), 0, 0)
    .tickFormat(intFormat);

  svg = d3.select('#vispanel')
    .append('svg')
      .attr('width', w)
      .attr('height',h)
    .append('g')
      .attr('transform', 'translate(' + (axisPadding - padding) + ',' + padding + ')');

  xAxisPanel = svg.append('g')
      .attr('class', 'x axis')
      .attr('id', 'xTicks')
      .attr('transform', 'translate(0,' + (h-axisPadding) + ')')
      .call(xAxis);
  xLegend = svg.append('text')
      .attr('id', 'xLabel')
      .attr('x', w/2)
      .attr('y', h-(axisPadding)+30)
      .attr('text-anchor', 'middle')
      .attr('class', 'axisTitle')
      .text(xField);
//      .on('click', changeAxis('x') );

  yAxisPanel = svg.append('g')
      .attr('class', 'y axis')
      .attr('id', 'yTicks')
      .attr('transform', 'translate(0,0)')
      .call(yAxis);
  yLegend = svg.append('text')
      .attr('id', 'yLabel')
      .attr('x', h/2)
      .attr('y', axisPadding - 30) // x and y are flipped on rotation
      .attr('text-anchor', 'end')
      .attr('class', 'axisTitle')
      .attr('transform', 'translate(-' + axisPadding + ',' + (h * 0.85) + ')rotate(-90)')
      .text(yField);
//      .on('click', changeAxis('y') );

  // TODO - make this selectable
  svg.selectAll('circle')
    .data(data)
      .enter()
    .append('circle')
      .attr('class', 'point')
      .attr('r', 6)
      .attr('cx', function(d) { return locate(d, 'x'); } )
      .attr('cy', function(d) { return locate(d, 'y'); } )
      .style('fill', function(d) { return colorize(d); } )
      .on('mouseover', mouseover)
      .on('mouseout', mouseout);

});


// set details with current item and emphasize visual item
function mouseover(d, i) {
  $('#details').css('display', 'inline');
  $('#detail-film-value').html(d.Film);
  $('#detail-year-value').html(d.Year);
  $('#detail-profitability-value').html(percentFormat(d['Profitability']));
  $('#detail-budget-value').html('$ ' + numberFormat(d['Budget']) + 'M');
  $('#detail-worldwide-value').html('$ ' + numberFormat(d['Worldwide Gross']) + 'M');
  $('#detail-domestic-value').html('$ ' + numberFormat(d['Domestic Gross']) + 'M');
  $('#detail-foreign-value').html('$ ' + numberFormat(d['Foreign Gross']) + 'M');
  $('#detail-audience-value').html(d['Audience Rating']);
  $('#detail-rotten-value').html(d['Critic Rating']);
  $('#detail-theatres-value').html(intFormat(d['Opening Weekend Theaters']));
  $('#detail-openingweekend-value').html('$ ' + numberFormat(d['Opening Weekend Revenue']) + 'M');
  $('#detail-avgcinema-value').html('$ ' + numberFormat(d['Opening Weekend per Cinema']));
  $('#detail-genre-value').html(d['Genre']);
  $('#detail-story-value').html(d['Story']);
  $('#detail-oscar-value').html(d['Oscar']);
  $('#detail-studio-value').html(d['Lead Studio']);

  d3.select(this)
      .style('stroke-width', 2.5)
      .style('stroke', 'orange')
      .style('stroke-opacity', 1.0)
      .style('fill-opacity', 1.0);
}

// reset detail view and visual properties
function mouseout(d, i) {
// TODO - keep details on screen for highlighted - for development only
//  $('#details').css('display', 'none');
  d3.select(this)
      .style('stroke-width', null)
      .style('stroke', null)
      .style('stroke-opacity', null)
      .style('fill-opacity', null);
}


// set up sliders and input boxes, and listen for events
// opts can be:
//  min, max : hard code the domain regardless of the data
//  prepend, append : add text to prepend or append to label values
var setupSliders = function(sliderElement, labelElement, labelFormatter, dataField, opts) {

  var minVal, maxVal;
  if ( opts && typeof opts.min !== 'undefined' ) {
    minVal = opts.min;
  }
  else {
    minVal = d3.round( d3.min(data, function(d) { 
          return $.isNumeric(d[dataField]) ? +d[dataField] : 0; 
        }) );
  }
  if ( opts && typeof opts.max !== 'undefined' ) {
    maxVal = opts.max;
  }
  else{
    maxVal = d3.round( d3.max(data, function(d) { 
          return $.isNumeric(d[dataField]) ? +d[dataField] : 0; 
        }) );
  }
  
  // init the sliders
  var sliderOpts = {
    range: true,
    min: minVal,
    max: maxVal,
    values: [ minVal, maxVal ],
    animate: true
  };
  $(sliderElement).slider(sliderOpts);
  $(sliderElement).on('slide', function( event, ui ) {
    $( labelElement ).val(
      (opts && opts.prepend ? opts.prepend : '') + labelFormatter(ui.values[0]) + (opts && opts.append ? opts.append : '') +
      ' - ' +
      (opts && opts.prepend ? opts.prepend : '') + labelFormatter(ui.values[1]) + (opts && opts.append ? opts.append : '')
    );
    filter({field: dataField, min: ui.values[0], max: ui.values[1]});
  });
  $(sliderElement).on('slidestop', function( event, ui ){
    zoom();
  });

  // set up the text values for the min and max
  $( labelElement ).val(
    (opts && opts.prepend ? opts.prepend : '') + labelFormatter(minVal) + (opts && opts.append ? opts.append : '') +
    ' - ' +
    (opts && opts.prepend ? opts.prepend : '') + labelFormatter(maxVal) + (opts && opts.append ? opts.append : '')
  );

  // update default allFilters values
  for ( var i = 0 ; i < allFilters.length ; i++ ) {
    if ( dataField === allFilters[i].field ) {
      allFilters[i].min = minVal;
      allFilters[i].max = maxVal;
      break;
    }
  }
}

// filter out data based on the spec
// spec: {field: dataField, min: minValue, max: maxValue}
var filter = function(spec) {

  // update global filters
  for ( var i = 0; i < allFilters.length; i++ ) {
    if ( allFilters[i].field === spec.field ) {
      allFilters[i].min = spec.min;
      allFilters[i].max = spec.max;
      break;
    }
  }

  // match data not in the range and hide those items
  svg.selectAll('circle')
      .select(function(d) {
        if ( (d[ allFilters[0].field ] < allFilters[0].min || d[ allFilters[0].field ] > allFilters[0].max)
          || (d[ allFilters[1].field ] < allFilters[1].min || d[ allFilters[1].field ] > allFilters[1].max)
          || (d[ allFilters[2].field ] < allFilters[2].min || d[ allFilters[2].field ] > allFilters[2].max)
          || (d[ allFilters[3].field ] < allFilters[3].min || d[ allFilters[3].field ] > allFilters[3].max)
          || (d[ allFilters[4].field ] < allFilters[4].min || d[ allFilters[4].field ] > allFilters[4].max)
          || (d[ allFilters[5].field ] < allFilters[5].min || d[ allFilters[5].field ] > allFilters[5].max)
          || (d[ allFilters[6].field ] < allFilters[6].min || d[ allFilters[6].field ] > allFilters[6].max)
          ) {
          d.display = false;
          return this;
        }
        else {
          return null;
        }
      })
      .style('display', 'none'); // hide items

  // match data within the range (for previously hidden (display:none) items)
  svg.selectAll('circle')
      .select(function(d) {
        if ( (d[ allFilters[0].field ] >= allFilters[0].min && d[ allFilters[0].field ] <= allFilters[0].max)
          && (d[ allFilters[1].field ] >= allFilters[1].min && d[ allFilters[1].field ] <= allFilters[1].max)
          && (d[ allFilters[2].field ] >= allFilters[2].min && d[ allFilters[2].field ] <= allFilters[2].max)
          && (d[ allFilters[3].field ] >= allFilters[3].min && d[ allFilters[3].field ] <= allFilters[3].max)
          && (d[ allFilters[4].field ] >= allFilters[4].min && d[ allFilters[4].field ] <= allFilters[4].max)
          && (d[ allFilters[5].field ] >= allFilters[5].min && d[ allFilters[5].field ] <= allFilters[5].max)
          && (d[ allFilters[6].field ] >= allFilters[6].min && d[ allFilters[6].field ] <= allFilters[6].max)
          ) {
          d.display = true;
          return this;
        }
        else {
          return null;
        }
      })
      .style('display', 'inherit'); // show item

}

// animate to zoomed in/out axis if filters change based on the
//  min/max values for the x/y fields that are shown (where data
//  item has display = true)
function zoom() {

  var xField = $('#xaxis').val();
  var yField = $('#yaxis').val();

  var xDomain = [d3.min(data, function(d, i) { return d.display && $.isNumeric(d[xField]) ? +d[xField] : null ; }) ,
            d3.max(data, function(d, i) { return d.display && $.isNumeric(d[xField]) ? +d[xField] : null ; })];

  var yDomain = [d3.min(data, function(d, i) { return d.display && $.isNumeric(d[xField]) ? +d[yField] : null ; }) ,
            d3.max(data, function(d, i) { return d.display && $.isNumeric(d[xField]) ? +d[yField] : null ; })];

  domain('x', xField, xDomain[0], xDomain[1]);
  xScale.domain(domain('x'));
  xAxis.scale(xScale);
  svg.select('#xTicks')
    .transition()
      .duration(TRANSITION_DURATION)
      .call(xAxis);
  redraw();

  domain('y', yField, yDomain[0], yDomain[1]);
  yScale.domain(domain('y'));
  yAxis.scale(yScale);
  svg.select('#yTicks')
    .transition()
      .duration(TRANSITION_DURATION)
      .call(yAxis);
  redraw();

}

// animate updated display when controls change (axes, color)
function redraw(filter) {
  svg.selectAll('circle')
    .transition()
      .duration(TRANSITION_DURATION)
      .style('fill', function(d) { return colorize(d); } )
      .attr('cx', function(d) { return locate(d, 'x'); } )
      .attr('cy', function(d) { return locate(d, 'y'); } );
}


// set up listeners when dom is ready
$( function() {

  // set up twipsy large quick start
  $('#vispanel').twipsy( {trigger:'manual'} );
  $('#detailpanel').twipsy( {trigger:'manual'} );
  $('#controls').twipsy( {trigger:'manual'} );
  $('#filters').twipsy( {trigger:'manual'} );

  // show tooltips again when user hovers on help icon (top right)
  $('#helpIcon').hover(
    // mouse in
    function() {
      $('#vispanel').twipsy('show');
      $('#detailpanel').twipsy('show');
      $('#controls').twipsy('show');
      $('#filters').twipsy('show');
    },
    // mouse out
    function() {
      $('#vispanel').twipsy('hide');
      $('#detailpanel').twipsy('hide');
      $('#controls').twipsy('hide');
      $('#filters').twipsy('hide');
    }
  );

  // immediately show popover help text, then hide after timeout
  $('#helpIcon').twipsy( {trigger:'manual'} );
  $('#helpIcon').twipsy('show');
  setTimeout(function() { $('#helpIcon').twipsy('hide'); }, 4000);


  // listen for changes to axis and color controls
  $('#xaxis').change(function() {
    xField = $('#xaxis').val();
    domain('x', xField);
    xScale.domain(domain('x'));
    xAxis.scale(xScale);
    svg.select('#xTicks').call(xAxis);
    svg.select('#xLabel').text(xField);
    redraw();
  });

  // listen for clicks to toggle linear (default) and log scales
  $('#xaxis-scale').click(function() {
    // if the scale is linear, toggle to log
    if ( axisType('x') === 'linear' ) {
      xScale = d3.scale.log()
        .domain(domain('x'))
        .range(range('x'))
        .nice();
      axisType('x', 'log');
      $(this).html('(log)');
    }
    // else if the scale is log, toggle to linear
    else {
      xScale = d3.scale.linear()
        .domain(domain('x'))
        .range(range('x'))
        .nice();
      axisType('x', 'linear');
      $(this).html('(linear)');
    }

    xScale.domain(domain('x'));
    xAxis.scale(xScale);
    svg.select('#xTicks')
      .transition()
        .duration(TRANSITION_DURATION)
        .call(xAxis);
    redraw();
  });

  $('#yaxis').change(function() {
    yField = $('#yaxis').val();
    domain('y', yField);
    yScale.domain(domain('y'));
    yAxis.scale(yScale);
    svg.select('#yTicks').call(yAxis);
    svg.select('#yLabel').text(yField);
    redraw();
  });

  // listen for clicks to toggle linear (default) and log scales
  $('#yaxis-scale').click(function() {
    // if the scale is linear, toggle to log
    if ( axisType('y') === 'linear' ) {
      yScale = d3.scale.log()
        .domain(domain('y'))
        .range(range('y'))
        .nice();
      axisType('y', 'log');
      $(this).html('(log)');
    }
    // else if the scale is log, toggle to linear
    else {
      yScale = d3.scale.linear()
        .domain(domain('y'))
        .range(range('y'))
        .nice();
      axisType('y', 'linear');
      $(this).html('(linear)');
    }

    domain('y', yField, yDomain[0], yDomain[1]);
    yScale.domain(domain('y'));
    yAxis.scale(yScale);
    svg.select('#yTicks')
      .transition()
        .duration(TRANSITION_DURATION)
        .call(yAxis);
    redraw();
  });

  $('#color').change(function() {
    colorField = $('#color').val();
    var scaleType;
    colorScale = null;
    
    if ( colorField === 'Story' ) {
      colorScale = storyColorScale;;
      scaleType = 'ordinal';
    }
    else if ( colorField === 'Genre' ) {
      var uniqVals = d3.keys( d3.nest().key( function(d) {
          return (d[colorField]).toLowerCase();
        } ).sortKeys().map(data));
      colorScale = genreColorScale.domain( uniqVals );
      scaleType = 'ordinal';
    }
    else {
      colorScale = numericColorScale.domain([
          d3.min(data, function(d) {return +d[colorField];}), 
          d3.sum(data, function(d) {return +d[colorField];}) / data.length,
          d3.max(data, function(d) {return +d[colorField];})
          ]);
      scaleType = 'quantile';
    }

    $('#colorpanel').html(''); // clear the old legend
    
    colorlegend('#colorpanel', colorScale, scaleType, {fill: true});
  
    redraw();
  });

});


