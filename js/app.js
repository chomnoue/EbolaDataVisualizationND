function draw(geo_data) {
    "use strict";
    var margin = 40,
            width = 600 - margin,
            height = 400 - margin;
    var lineChartXAxisPos = height / 3;
    var lineChartHeight = height / 4;
    var lineChartWidth = width * 0.8;
    var lineChartYMargin = 20;
    var monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];


    var format = d3.time.format("%Y-%m-%d");

    var title = d3.select("body")
            .select('h3');


    var svg = d3.select("body")
            .select("svg")
            .attr("width", width + margin)
            .attr("height", height + margin)
            .append('g')
            .attr('class', 'map');

    var lineChart = d3.select("body")
            .select("svg").append('g');


    var projection = d3.geo.mercator()
            .scale(1000)
            .translate([width / 1.8, height / 0.8]);

    var path = d3.geo.path().projection(projection);


    function drawData(data) {

        //fix data
        function getDates(data) {
            return d3.set(data.map(function (d) {
                return format(d.Date);
            })).values().sort(d3.ascending);
        }
        var dates = getDates(data);
        var datesByIndicator = d3.nest()
                .key(function (d) {
                    return d.Indicator;
                }).rollup(function (leaves) {
            return new Date(d3.max(getDates(leaves)));
        }).map(data, d3.map);

        var maxDate = new Date(dates[dates.length - 1]);
        //look for indicators that are not maintained
        var unMaintainedIndicators = d3.set(datesByIndicator.keys()
                .filter(function (indicator) {
                    return maxDate.getFullYear() > datesByIndicator.get(indicator).getFullYear();
                }));

        data = data.filter(function (d) {
            return !unMaintainedIndicators.has(d.Indicator);
        });

        //fix cumulative indicators, registering the previous 
        //value for dates where the indicator has not been set
        var byIndicatorAndDate = d3.nest()
                .key(function (d) {
                    return d.Indicator;
                })
                .key(function (d) {
                    return d.Country;
                })
                .key(function (d) {
                    return format(d.Date);
                })
                .map(data, d3.map);
        var dataToAdd = [];
        byIndicatorAndDate.keys().filter(function (indicator) {
            return indicator.startsWith("Cumulative");
        }).forEach(function (indicator) {
            byIndicatorAndDate.get(indicator).keys().forEach(function (country) {
                var byDate = byIndicatorAndDate.get(indicator).get(country);
                var currentData = null;
                dates.forEach(function (date) {
                    if (byDate.has(date)) {
                        var newData = byDate.get(date)[0];
                        //a cumulative value must not decrease
                        if (currentData && newData.value < currentData.value) {
                            newData.value = currentData.value;
                        }
                        currentData = newData;
                    } else {
                        if (currentData) {
                            var newData = {};
                            for (var key in currentData) {
                                newData[key] = currentData[key];
                            }
                            newData.Date = format.parse(date);
                            dataToAdd.push(newData);
                        }
                    }
                });
            });
        });
        data = data.concat(dataToAdd);
        // organise data
        function getCountries(data) {
            return d3.set(data.map(function (d) {
                return d.Country;
            }));
        }
        var countries = getCountries(data);


        //retain only the countries existing in the dat set
        var countryFeatures = geo_data.features.filter(function (feature) {
            return countries.has(feature.properties.name);
        });

        //grouping by indicator,year , month and day
        var nested = d3.nest()
                .key(function (d) {
                    return d.Indicator;
                })
                .key(function (d) {
                    return d.Date.getFullYear();
                })
                .key(function (d) {
                    return d.Date.getMonth();
                })
                .key(function (d) {
                    return d.Date.getDate();
                })
                .map(data, d3.map);
        //compute max values for each indicator
        var maxValues = d3.nest()
                .key(function (d) {
                    return d.Indicator;
                }).rollup(function (leaves) {
            return d3.max(leaves, function (leave) {
                return leave.value;
            });
        }).map(data, d3.map);
        var countryCenters = {};
        //finding the center to place the circle and text for each country
        countryFeatures.forEach(function (feature) {
            var coordinates = feature.geometry.coordinates[0];
            if (feature.geometry.type === 'MultiPolygon') {
                coordinates = coordinates[0];
            }
            var coords = coordinates.map(function (coord) {
                return projection(coord);
            });
            var center_x = d3.mean(coords, function (coord) {
                return coord[0];
            });
            var center_y = d3.mean(coords, function (coord) {
                return coord[1];
            });
            countryCenters[feature.properties.name] = {x: center_x, y: center_y};
        });

        function countryKey(d) {
            return d.properties.name;
        }

        var map = svg.selectAll('path')
                .data(geo_data.features, countryKey)
                .enter()
                .append('path')
                .attr('d', path)
                .style('fill', 'none')
                .style('stroke', 'none')
                .style('stroke-width', 0.5);



        var texts = svg.append('g')
                .attr("class", "text")
                .selectAll("text")
                .data(countryFeatures, countryKey)
                .enter()
                .append("text")
                .attr('x', function (d) {
                    return countryCenters[d.properties.name].x;
                })
                .attr('y', function (d) {
                    return countryCenters[d.properties.name].y;
                });
        function drawLineChart(indicator) {
            var selectedData = data.filter(function (d) {
                return d.Indicator === indicator;
            });
            var nestedData = d3.nest()
                    .key(function (d) {
                        return format(d.Date);
                    })
                    .rollup(function (leaves) {
                        return d3.sum(leaves, function (d) {
                            return d.value;
                        });
                    }).map(selectedData, d3.map);
            var yscale = d3.scale.linear()
                    .range([lineChartHeight, 0])
                    .domain([0, d3.max(nestedData.values())]);
            var xscale = d3.time.scale()
                    .nice(d3.time.month)
                    .domain(d3.extent(dates).map(function (date) {
                        return new Date(date);
                    }))
                    .range([0, lineChartWidth]);
            var xAxis = d3.svg.axis()
                    .scale(xscale)
                    .orient("bottom");
            //.ticks(d3.time.months);

            var yAxis = d3.svg.axis()
                    .scale(yscale)
                    .orient("left");


            lineChart.selectAll("*").remove();
            lineChart.append("g")
                    .attr("class", "x axis")
                    .attr("transform", "translate(" + lineChartXAxisPos + "," + (lineChartHeight + lineChartYMargin) + ")")
                    .call(xAxis);

            lineChart.append("g")
                    .attr("class", "y axis")
                    .attr("transform", "translate(" + lineChartXAxisPos + "," + lineChartYMargin + ")")
                    .call(yAxis)
                    .append("text")
                    .attr("transform", "rotate(-90)")
                    .attr("y", 6)
                    .attr("dy", ".71em")
                    .style("text-anchor", "end")
                    .text("Cases");
            var x = function (d) {
                return xscale(new Date(d)) + lineChartXAxisPos;
            };
            var y = function (d) {
                return yscale(nestedData.get(d)) + lineChartYMargin;
            };
            var line = d3.svg.line()
                    .x(x)
                    .y(y)
                    .interpolate("linear");
            lineChart.append('path')
                    .attr('d', line(nestedData.keys()
                            .sort(d3.ascending)))
                    //.attr("transform", "translate(" + lineChartXAxisPos + "," + 20 + ")")
                    .attr("fill", "none")
                    .style('stroke', 'red')
                    .style('stroke-width', 0.3);

            var circle = lineChart.append("circle")
                    .style("visible", "hidden")
                    .attr("r", 5)
                    .style("fill", "red");
            //function used to place the cicle on the line
            return function (date) {
                circle.attr("cx", x(date))
                        .attr("cy", y(date))
                        .style("visible", "visible");
            };
        }


        function update(selected) {
            var selectedData = nested.get(selected.indicator)
                    .get(selected.year)
                    .get(selected.month)
                    .get(selected.day);
            var radius = d3.scale.log()
                    .domain([1, maxValues.get(selected.indicator)])
                    .range([0, 18]);

            svg.select(".bubble").remove();

            svg.append('g')
                    .attr("class", "bubble")
                    .selectAll("circle")
                    .data(selectedData)
                    .enter()
                    .append("circle")
                    .attr('cx', function (d) {
                        return countryCenters[d.Country].x;
                    })
                    .attr('cy', function (d) {
                        return countryCenters[d.Country].y;
                    })
                    .attr('r', function (d) {
                        return radius(d.value + 1);//because log(1)=0, this will make values of 0 have a radius of 0 an values 1 a radius of log(2)
                    });
            var countries = getCountries(selectedData);

            map.style('fill', function (d) {
                if (countries.has(d.properties.name)) {
                    return "orange";
                }
                return "none";
            }).style('stroke', function (d) {
                if (countries.has(d.properties.name)) {
                    return "black";
                }
                return "none";
            });

            texts.text(function (d) {
                if (countries.has(d.properties.name)) {
                    return d.properties.name;
                }
                return "";
            });
            var date = new Date(selected.year, selected.month, selected.day);
            title.text(selected.indicator + " in West Africa on "
                    + d3.time.format("%m/%d/%Y")(date));
            selected.updateLineChart(format(date));
            return selectedData.length !== 0;
        }

        var menu = d3.select("body")
                .select("div.menu")
                .select("table");

        menu.append("tr").append("td")
                .text("Indicator");

        var selectIndicators = menu.append("tr").append("td")
                .append("select");

        menu.append("tr").append("td")
                .text("Date");
        var date_raw = menu.append("tr").append("td");
        function bulidSelect() {
            return date_raw
                    .append("select");
        }

        var selectYears = bulidSelect();
        var selectMonths = bulidSelect();
        var selectDays = bulidSelect();
        var buttonsRaw=menu.append("tr").append("td");
        var playButton = buttonsRaw
                .append("input")
                .attr("type", "submit")
                .attr("class", "button")
                .attr("value", "Play the animation");
        
        var stopButton=buttonsRaw
                .append("input")
                .attr("type", "submit")
                .attr("class", "button")
                .attr("value", "Stop the animation");
        
        function buildOptions(select, data, value) {
            function getAttrOrSelf(attr) {
                return function (d) {
                    if (d[attr]) {
                        return d[attr];
                    }
                    else {
                        return d;
                    }
                };
            }
            var getValue = getAttrOrSelf("value");
            var getTex = getAttrOrSelf("text");
            select.selectAll("option").remove();
            var options = select
                    .selectAll("option")
                    .data(data)
                    .enter()
                    .append("option")
                    .attr("value", getValue)
                    .text(getTex).each(function (d) {
                if (getValue(d) === value) {
                    d3.select(this).attr("selected", "selected");
                }
            });
            return options;
        }
        function sortInts(a, b) {
            return d3.ascending(+a, +b);
        }

        var indicators = nested.keys().sort();
        function triggerChangeEvent(select) {
            select.on("change").apply(select.node());
        }

        // buildSelectOptions(selected);

        //console.log(indicators.values());
        var indicator = 'Number of confirmed Ebola cases in the last 21 days';//indicators.values()[0];//

        function play(indicator) {
            function buildSelectOptions(selected) {
                buildOptions(selectIndicators, indicators, selected.indicator);
                selectIndicators.on("change", function () {
                    var indicator = indicators[this.selectedIndex];
                    var updateLineChart = drawLineChart(indicator);
                    var years = nested.get(indicator).keys().sort(sortInts);
                    buildOptions(selectYears, years, selected.year);
                    selectYears.on("change", function () {
                        var year = years[this.selectedIndex];
                        var months = nested.get(indicator).get(year)
                                .keys().sort(sortInts);
                        buildOptions(selectMonths, months.map(function (month) {
                            return {text: monthNames[month], value: month};
                        }), selected.month);
                        selectMonths.on("change", function () {
                            var month = months[this.selectedIndex];
                            var days = nested.get(indicator).get(year)
                                    .get(month).keys().sort(sortInts);
                            buildOptions(selectDays, days, selected.day);
                            selectDays.on("change", function () {
                                var day = days[this.selectedIndex];
                                update({indicator: indicator,
                                    year: year, month: month,
                                    day: day, updateLineChart: updateLineChart});
                            });
                            triggerChangeEvent(selectDays);

                        });
                        triggerChangeEvent(selectMonths);
                    });
                    triggerChangeEvent(selectYears);                    
                    playButton.attr('value', 'Play the animation');
                    playButton.on("click", function () {
                        play(indicator);
                    });
                });
            }

            menu.selectAll("select").attr("disabled", "disabled");
            var updateLineChart = drawLineChart(indicator);
            //enumerate data to be played by the animation;
            var selectors = d3.merge(
                    nested.get(indicator).keys().sort(sortInts).map(function (year) {
                return d3.merge(
                        nested.get(indicator).get(year).keys().sort(sortInts).map(function (month) {
                    return nested.get(indicator).get(year).get(month).keys().sort(sortInts).map(function (day) {
                        return {
                            year: year,
                            month: month,
                            day: day,
                            indicator: indicator,
                            updateLineChart: updateLineChart
                        };
                    });
                })
                        );

            })
                    );
            var idx = 0;
            var sel = null;

            function resume() {
                var dateInterval = setInterval(function () {
                    sel = selectors[idx];
                    update(sel);
                    idx++;
                    if (idx >= selectors.length) {
                        stop();
                    }
                }, 500);

                function pause() {
                    if (dateInterval) {
                        clearInterval(dateInterval);
                    }
                    playButton.attr('value', 'Resume the animation');
                    playButton.on('click', resume);
                }
                playButton.attr('value', 'Pause the animation');
                playButton.on('click', pause);
                function stop() {
                    if (dateInterval) {
                        clearInterval(dateInterval);
                    }
                    //select the last day  and  
                    buildSelectOptions(selectors[selectors.length - 1]);
                    triggerChangeEvent(selectIndicators);
                    menu.selectAll("select").attr("disabled", null);
                    stopButton.attr("disabled", "disabled");
                }
                stopButton.attr("disabled", null);
                stopButton.on('click',stop);
            }

            resume();

        }
        play(indicator);
        //update(dates[0], indicator);

    }
    d3.csv('data/ebola_data_db_format.csv', function (d) {
        d.Date = format.parse(d.Date);
        d.value = +d.value;
        return d;
    }, drawData);
}
;

d3.json("data/world_countries.json", draw);