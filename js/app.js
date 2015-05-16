function draw(geo_data) {
    "use strict";
    var margin = 40,
            width = 600 - margin,
            height = 400 - margin;

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



    var projection = d3.geo.mercator()
            .scale(1000)
            .translate([width / 1.8, height / 0.8]);

    var path = d3.geo.path().projection(projection);


    function drawData(data) {
        //first organise data
        var countries = d3.set(data.map(function (d) {
            return d.Country;
        }));

        var selected = {
            year: null,
            month: null,
            day: null,
            indicator: null
        };
        //retain only the countries existing in the dat set
        var features = geo_data.features.filter(function (feature) {
            return countries.has(feature.properties.name);
        });

        //grouping by year , month and day
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
        features.forEach(function (feature) {
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
        console.log(countries.values());
        var map = svg.selectAll('path')
                .data(geo_data.features)
                .enter()
                .append('path')
                .attr('d', path)
                .style('fill', function (d) {
                    if (countries.has(d.properties.name)) {
                        return 'orange';
                    } else {
                        return 'lightBlue';
                    }
                })
                .style('stroke', 'black')
                .style('stroke-width', 0.5);



        svg.append('g')
                .attr("class", "text")
                .selectAll("text")
                .data(features)
                .enter()
                .append("text")
                .attr('x', function (d) {
                    return countryCenters[d.properties.name].x;
                })
                .attr('y', function (d) {
                    return countryCenters[d.properties.name].y;
                })
                .text(function (d) {
                    return d.properties.name;
                });



        function update(selected) {
            var selectedData = nested.get(selected.indicator)
                    .get(selected.year)
                    .get(selected.month)
                    .get(selected.day);
            var radius = d3.scale.log()
                    .domain([1, maxValues.get(selected.indicator)])
                    .range([0, 15]);

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
            title.text(selected.indicator + " in West Africa on "
                    + d3.time.format("%m/%d/%Y")(new Date(selected.year, selected.month, selected.day)));
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
        var playButton = menu.append("tr").append("td")
                .append("input")
                .attr("type", "submit")
                .attr("value","Play the animation");
        function buildOptions(select, data, value) {
            select.selectAll("option").remove();
            var options = select
                    .selectAll("option")
                    .data(data)
                    .enter()
                    .append("option")
                    .attr("value", function (d) {
                        return d.value;
                    })
                    .text(function (d) {
                        return d.text;
                    }).each(function (d) {
                if (d.value === value) {
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
                buildOptions(selectIndicators, indicators.map(function (indicator) {
                    return {text: indicator, value: indicator};
                }), selected.indicator);
                selectIndicators.on("change", function () {
                    var indicator = indicators[this.selectedIndex];
                    var years = nested.get(indicator).keys().sort(sortInts);
                    buildOptions(selectYears, years.map(function (year) {
                        return {text: year, value: year};
                    }), selected.year);

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
                            buildOptions(selectDays, days.map(function (day) {
                                return {text: day, value: day};
                            }), selected.day);
                            selectDays.on("change", function () {
                                var day = days[this.selectedIndex];
                                update({indicator:indicator,year:year,month:month,day:day});
                            });
                            triggerChangeEvent(selectDays);

                        });
                        triggerChangeEvent(selectMonths);
                    });
                    triggerChangeEvent(selectYears);
                    playButton.on("click",function(){
                        play(indicator);
                    });
                });
            }
            
            menu.selectAll("select,input").attr("disabled","disabled");

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
                            indicator: indicator
                        };
                    });
                })
                        );

            })
                    );
            var idx = 0;
            var sel = null;
            var dateInterval = setInterval(function () {
                sel = selectors[idx];
                update(sel);
                idx++;
                if (idx >= selectors.length) {
                    clearInterval(dateInterval);
                    //select the last day  and  
                    buildSelectOptions(sel);
                    triggerChangeEvent(selectIndicators);
                    menu.selectAll("select,input").attr("disabled",null);
                }
            }, 500);
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