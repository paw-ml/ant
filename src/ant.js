//import * as d3 from "./d3.v7.min.js"
import {Tabulator} from '../tabulator/js/tabulator_esm.min.mjs';
import * as d3 from "https://cdn.skypack.dev/d3@7";
class AntEvents {
    events = {}
    addEventListener(me, event, cb) {
        if (event in this.events === false) {
            this.events[event] = []
        }
        this.events[event].push({"context": me, "callback": cb})
    }
    emitEvent(event, data) {
        if (event in this.events) {
            for (var i in this.events[event]) {
                this.events[event][i]["callback"].apply(this.events[event][i]["context"], [data])
            }
        }
    }
}
class AntGroupEvents extends AntEvents {
    handler = null
    charts = []
    constructor (handler) {
        super()
        this.handler = handler
    }
    addChart (chart) {
        this.charts.push(chart)
        chart.setEventsManager(this)
    }
}
class AntGroupsPlot {
    constructor(eventsManager) {
        this.setEventsManager(eventsManager)
    }
    eventsManager = null;
    setEventsManager(mgr) {
        this.eventsManager = mgr
    }
    addEventListener(event, cb) {
        this.eventsManager.addEventListener(this, event, cb)
    }
    emitEvent(event, data) {
        this.eventsManager.emitEvent(event, data)
    }
    groupData() {
        let r = [this.source.dataset['plot_label']].concat(this.source.dataset['plot_x'].split(',').slice(0, -1))
        let xCol = this.source.dataset['plot_x'].split(',').slice(-1)
        let yCol = this.source.dataset['plot_y']
        function rollup (sequences) { 
            let x = [], y = [], xy = []
            for (let i in sequences) {
                x.push(sequences[i][xCol])
                y.push(sequences[i][yCol])
                xy.push ([sequences[i][xCol], sequences[i][yCol]])
            }
            return xy
        }
        let args = this.getArgs(this.group, r, rollup)
        return d3.flatRollup.apply(this, args)
    }
    getArgs(data, groups, rollup) {
        let args = [data]
        if (rollup) args.push(rollup)
        for (let grp in groups) {
            let fn = function(grp) {
                return function(d) { return d[grp] }
            }
            args.push(fn(groups[grp]))
        }
        return args
    }
    getDomain(groups) {
        let vals = []
        for (let g in groups) {
            let grp = groups[g], col = grp[grp.length - 1]
            vals.push(...col.map((d) => d[0]))

        }
        let unique = [... new Set(vals)].sort()
        return unique
    }
    getExtent(groups) {
        let allX = [], allY = []
        for (let g in groups) {
            let grp = groups[g], col = grp[grp.length - 1]
            var extX = d3.extent(col, d => parseInt(d[0]))
            var extY = d3.extent(col, d => parseInt(d[1]))
            
            allX.push(extX[0])
            allX.push(extX[1])
            allY.push(extY[0])
            allY.push(extY[1])
        }
        return [allX, allY]
    }
}
class AntGroupsPivot extends AntGroupsPlot {
    group = null
    container = null
    source =null
    width = 1000
    height = 500
    margin = 10
    config = null;
    constructor(source, container, svg, group, colorScale, config, eventsManager) {
        super(eventsManager)
        var bb = svg.node().getBoundingClientRect()
        svg.remove()
        this.addEventListener('highlight', this.handleHiglight)
        this.source = source
        this.group = group
        this.container = container
        this.config = config
        this.colorScale = colorScale
        this.width = bb.width
        this.height = bb.height;

        this.build(this.groupData())
    }
    build(data) {
        var flat = []
        var cols = []
        for (var g in data) {
            var obj = {}
            if ('plot_tooltip_callback' in this.source.dataset) {
                const cb = this.config.callbacks[this.source.dataset['plot_tooltip_callback']]
            
                for (var i in data[g][2]) {
                    const labels = cb.apply(this, [data[g][0], data[g][1], data[g][2][i][0], data[g][2][i][1]])
                    for (var l in labels.slice(0, -2)) {
                        obj[labels[l][0]] = labels[l][1]
                        if (cols.indexOf(labels[l][0]) === -1) {
                            cols.push(labels[l][0])
                        }
                    }
                
                    //if (labels.length > 3) {
                        obj[labels[labels.length - 2][1]] = labels[labels.length - 1][1]
                        if (cols.indexOf(labels[labels.length - 2][1]) == -1) {
                            cols.push(labels[labels.length - 2][1])
                        }
                    //}
                }
            }
            flat.push(obj)
            var c = []
            for (var d in cols.slice(0, 2)) {
                c.push ({title: cols[d], field: cols[d], width: 100, frozen: true})
            }
            var s = cols.slice(2).sort()
            for (var d in s) {
                c.push ({title: s[d], field: s[d]})
            }
        }
        var tbl = new Tabulator(this.container, {
            renderVerticalBuffer:300,
            renderHorizontalBuffer: 500,
            data: flat,
            height: 300,
            width: 600,
            // //autoColumns: true,
            //width: '300px',
            // height: '100%',
            columns: c,
            //layout:"fitDataTable",
        })
    }
    handleHiglight(data) {

    }
}
class AntGroupsLabels extends AntGroupsPlot {
    group = null
    container = null
    source =null
    width = 1000
    height = 500
    margin = 10
    config = null;
    constructor(source, container, svg, group, colorScale, config, eventsManager) {
        super(eventsManager)
        this.addEventListener('highlight', this.handleHiglight)
        this.source = source
        this.group = group
        this.container = container
        this.config = config
        this.colorScale = colorScale
    }
    handleHiglight(data) {
        if ('plot_tooltip_callback' in this.source.dataset) {
            const cb = this.config.callbacks[this.source.dataset['plot_tooltip_callback']]
            const labels = cb.apply(this, data)
            d3.select(this.container).selectAll('div')
                .data(labels)
                .join(
                    enter => enter.append('div').html(d => d[0] + '<br/>' + d[1]),
                    update => update.html(d => d[0] + '<br/>' + d[1])
                )
        }
        //console.log(data)
    }
}
class AntGroupsCartesian extends AntGroupsPlot {
    group = null
    container = null
    source =null
    width = 1000
    height = 500
    margin = 10
    config = null;
    constructor(source, container, svg, group, colorScale, config, eventsManager) {
        super(eventsManager)
        this.addEventListener('highlight', this.handleHiglight)
        this.source = source
        this.group = group
        this.container = container
        this.svg = svg
        this.svg.append("g").attr('class', 'axes')
        this.config = config
        this.colorScale = colorScale

        var bb = svg.node().getBoundingClientRect()
        this.height = bb.height;
        this.width = bb.width;

        this.plot(this.groupData())
    }
    handleHiglight(data) {
        //console.log('cartesian', data)
    }
    plot (groups) {
        var flat = {}
        for (var g in groups) {
            function cb(d) {
                var k = groups[g][1] + d[0]
                return [[k, d[1]]]
                var r = {}
                r[k] = d[1]
                return r
            }
            if (groups[g][0] in flat === false) {
                flat[groups[g][0]] = []
            }
            flat[groups[g][0]] = flat[groups[g][0]].concat(groups[g][2].flatMap(cb))
        }
        var [x, y] = this.setupAxis(groups)
        function coordinateX(d) {
            return x(d.datum[1])
        }
        function coordinateY(d) {
            return y(d.universe[d.index - 1][1])
        }
        function getData(d) {
            var ret  = []
            for (var i in d._groups[0]) {
                var data = d._groups[0][i].__data__
                for (var r in data[1][2]) {
                    if (r > 0) {
                        //console.log(r, data[1][0], data[1][1])
                        ret.push({label: data[1][0], group: data[1][1], datum: data[1][2][r], index: r, universe: data[1][2]})
                    }
                }
                //data = [...data[1].slice(0, 2), ...data[1][2]]
            }
            return ret
        }
        this.svg
        .selectAll("g.dataset")
            .data(Object.entries(groups))
            .join(
                e => e.append('g')
                    .attr("class", "dataset")
                    .selectAll("circle")
                    .data(getData(e))
                    .join(
                    enter => enter.append('circle')
                        .attr("r", 5)
                        .attr("cx", coordinateX)
                        .attr("cy", coordinateY)
                        .attr("fill", this.colorScale)
                        .attr("stroke", this.colorScale),
                    update => update.transition()
                        .duration(500)
                        .attr("cx", coordinateX)
                        .attr("cy", coordinateY)
                        .attr("fill", this.colorScale)
                        .attr("stroke", this.colorScale)
                    ),
                u => u.selectAll("circle")
                    .data(getData(u))
                    .join(
                        enter => enter.append('circle')
                            .attr("r", 5)
                            .attr("cx", coordinateX)
                            .attr("cy", coordinateY)
                            .attr("fill", this.colorScale)
                            .attr("stroke", this.colorScale),
                        update => update.transition()
                            .duration(500)
                            .attr("cx", coordinateX)
                            .attr("cy", coordinateY)
                            .attr("fill", this.colorScale)
                            .attr("stroke", this.colorScale)
                    )
                    
            )
    }
    setupAxis(groups) {
        var all = this.getExtent(groups)
        const scaleX = d3.scaleLinear()
            .domain(d3.extent(all[1]))
            .range([this.margin, this.width - this.margin])
            .nice()

        const scaleY = d3.scaleLinear()
            .domain(d3.extent(all[1]))
            .range([this.height - this.margin, this.margin])
            .nice();
        
        const xAxis = d3.axisBottom(scaleX);
        const yAxis = d3.axisLeft(scaleY);
        const axes = this.svg.select("g.axes")

        axes.selectAll(".grid").remove()

        axes.selectAll("g.x-axis")
            .data([true])
            .join(
                enter => enter.append('g')
                    .attr('class', 'x-axis')
                    .attr("transform", `translate(${[0, this.height / 2]})`)
                    .call(xAxis),
                update => update.transition()
                    .duration(500)
                    .call(xAxis)
            )
            .call(
                g => g.selectAll(".tick line").clone()
                .attr('class', 'grid')
                .attr("transform", `translate(${[0, -(this.height / 2)]})`)
                .attr("y2", (this.height - (this.margin * 2)))
                .attr("stroke-opacity", 0.1)
            )
        
        axes.selectAll("g.y-axis")
            .data([true])
            .join(
                enter => enter.append('g')
                    .attr('class', 'y-axis')
                    .attr("transform", `translate(${[this.width / 2, 0]})`)
                    .attr("stroke-width", 1.5)
                    .transition()
                    .duration(500)
                    .call(yAxis),
                update => update.transition()
                    .duration(500)
                    .call(yAxis)
            )
            .call(
                g => g.selectAll(".tick line").clone()
                .attr('class', 'grid')
                .attr("transform", `translate(${[(this.width / 2), 0]})`)
                .attr("x2", -(this.width - (this.margin * 2)))
                .attr("stroke-opacity", 0.1)
            )
        return [scaleX, scaleY]
    }
}

class AntGroupsLine extends AntGroupsPlot {
    group = null
    container = null
    source =null
    width = 1000
    height = 500
    margin = 60
    config = null;
    constructor(source, plotContainer, svg, group, colorScale, config, eventsManager) {
        super(eventsManager)
        this.addEventListener('highlight', this.handleHiglight)
        this.source = source
        this.group = group
        this.container = plotContainer
        this.svg = svg
        this.svg.append("g").attr('class', 'axes')
        this.colorScale = colorScale
        
        this.config = config

        var bb = svg.node().getBoundingClientRect()
        this.height = bb.height;
        this.width = bb.width;
        this.plot(this.groupData())
    }
    handleHiglight() {
        console.log('line')
    }
    plot(groups) {
        var all = this.getExtent(groups)
        const scaleX = d3.scalePoint()
            .domain(this.getDomain(groups))
            .range([this.margin, this.width - this.margin]);

        const scaleY = d3.scaleLinear()
            .domain(d3.extent(all[1]))
            .range([this.height - this.margin, this.margin])
            .nice();

        const xAxis = d3.axisBottom(scaleX);
        const yAxis = d3.axisLeft(scaleY);
        const axes = this.svg.select("g.axes")
        axes.selectAll(".grid").remove()
        axes.selectAll("g.x-axis")
            .data([true])
            .join(
                enter => enter.append('g')
                    .attr('class', 'x-axis')
                    .attr("transform", `translate(${[0, this.height - this.margin]})`)
                    .call(xAxis),
                update => update.transition()
                    .duration(500)
                    .call(xAxis)
            )
        axes.selectAll("g.y-axis")
            .data([true])
            .join(
                enter => enter.append('g')
                    .attr('class', 'y-axis')
                    .attr("transform", `translate(${[this.margin, 0]})`)
                    .attr("stroke-width", 1.5)
                    .transition()
                    .duration(500)
                    .call(yAxis),
                update => update.transition()
                    .duration(500)
                    .call(yAxis)
            ).call(g => g.selectAll(".tick line").clone()
                    .attr('class', 'grid')
                    .attr("x2", this.width - (this.margin * 2))
                    .attr("stroke-opacity", 0.1)
            )
        
        const line = function (d) {
            var xy = d[d.length - 1]
            var line = d3
                .line()
                .x(d => scaleX(d[0]))
                .y(d => scaleY(d[1]));
            return line(xy)
        }
        var me = this
        const tooltip = this.svg.append("g")

        function size(text, path) {
            const {x, y, width: w, height: h} = text.node().getBBox();
            text.attr("transform", `translate(${-w / 2},${10 - y})`);
            path.attr("d", `M${-w / 2 - 5},5H-5l5,-5l5,5H${w / 2 + 5}v${h + 10}h-${w + 10}z`);
        }
        function pointerLeft() {
            tooltip.style("display", "none");
          }

        function pointerMoved(ev, data) {
            if (data == undefined) return;
            tooltip.style("display", null)
            var lineData = data[data.length - 1]
            var domain = scaleX.domain()
            var range = scaleX.range();
            var rangePoints = d3.range(range[0], range[1] + scaleX.step(), scaleX.step())
            const x = d3.bisectCenter(rangePoints, d3.pointer(ev)[0])
            const m = lineData.map((d) => d[0])
            const i = m.indexOf(domain[x])
            tooltip.attr("transform", `translate(${scaleX(lineData[i][0])},${scaleY(lineData[i][1])})`);
            me.emitEvent.apply(me, ['highlight', data.slice(0, -1).concat(lineData[i])])
            if ('callbacks' in me.config && 'plot_tooltip_callback' in me.source.dataset && me.source.dataset['plot_tooltip_callback'] in me.config.callbacks) {
                
                const cb = me.config.callbacks[me.source.dataset['plot_tooltip_callback']]
                const labels = cb.apply(me, data.slice(0, -1).concat(lineData[i]))

                const path = tooltip.selectAll("path")
                  .data([,])
                  .join("path")
                    .attr("fill", "white")
                    .attr("stroke", "black");
            
                const text = tooltip.selectAll("text")
                  .data([,])
                  .join("text")
                  .call(text => text
                                .selectAll("tspan")
                                .data(labels)
                                .join("tspan")
                                    .attr("x", 0)
                                    .attr("y", (_, i) => `${i * 1.1}em`)
                                    .attr("font-weight", (_, i) => i ? null : "bold")
                                    .attr("font-size", "x-small")
                                    .text(d => d[1])
                    )

                size(text, path)
            }
        }

        this.svg
        .selectAll("path.dataset")
            .data(groups.values())
            .join(
                enter => enter.append('path')
                    .attr("class", "dataset")
                    .attr("d", line)
                    .attr("fill", "none")
                    .attr("stroke", this.colorScale),
                update => update.transition()
                    .duration(500)
                    .attr("d", line)
                    .attr("stroke", this.colorScale)
            )
        .on("pointerenter pointermove", pointerMoved)


        this.svg
        .on("pointerleave", pointerLeft)
    }
    pointerMoved(event, data) {
        
    }
}

class AntGroups {
    source = null;
    container = null;
    group = null;
    levels = null;
    plotContainer = {}
    svg = {}
    config = null;
    eventHandler = null;
    constructor (source, group, config) {
        this.eventHandler = new AntGroupEvents(this)
        this.source = source
        this.group = group
        this.levels = source.dataset['groupby'].split(',')
        this.config = config
        if ('saveas' in source.dataset) {
            this.data[source.dataset['saveas']] = r
        }
        if ('plot' in source.dataset && 'plot_container' in source.dataset) {
            this.container = document.querySelector(source.dataset['plot_container'])
            this.setupContainer()
        }
    }

    setupContainer() {
        if (this.container) {
            this.container.replaceChildren();
            
            this.setupNavigation()
            this.setupPlot()

        }
    }
    setupPlot() {
        var plots = this.source.dataset['plot'].split(',')
        for (var p in plots) {
            this.plotContainer[plots[p]] = document.createElement('DIV')

            this.plotContainer[plots[p]].classList.add('ant_plot_container')

            this.container.appendChild(this.plotContainer[plots[p]])
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.plotContainer[plots[p]].appendChild(svg)

            this.svg[plots[p]] = d3.select(svg)

            var bb = this.plotContainer[plots[p]].getBoundingClientRect()
            var height = parseInt(bb.width)
            if ('plot_aspect_ratio' in this.source.dataset) {
                var ars = this.source.dataset['plot_aspect_ratio'].split(',')
                var ar = ars[p].split(':')
                if (ar.length == 2) {
                    height = parseInt(bb.width) / (parseInt(ar[0]) / parseInt(ar[1]))
                } 
            }

            this.svg[plots[p]]
                .attr('width', parseInt(bb.width))
                .attr('height', height)
                .attr('viewBox', '0 0 '+ parseInt(bb.width) + ' ' + parseInt(height))
                .attr("preserveAspectRatio", "xMinYMin meet");

        }
        
    }
    setupNavigation () {
        let mcont = document.createElement('DIV')
        mcont.classList.add('ant_group_controls')
        
        let levels = this.levels
        let scope = this
        var nav = {}
        let parseLevel = function (group, index, nav) {
            console.log(group)
            let levelName = levels[index]
            let handler = function(e) {
                let key = e.target.value
                nav[levelName] = key
                let el = e.target.parentNode.nextSibling
                while (el) {
                    let n = el.nextSibling
                    el.remove()
                    el = n
                }
                parseLevel(group.get(key), index + 1, nav)
            }
            if (levelName) {
                let navEl = document.createElement('DIV')
                navEl.classList.add('select')
                let sel = document.createElement('SELECT')
                sel.addEventListener('change', handler)
                sel.appendChild(new Option('-- '+ levelName +' --', '-'))
                let selOpt = function(sel) {
                    return function(_, key) {
                        let opt = new Option(key, key)
                        sel.appendChild(opt)
                    }
                }   
                group.forEach(selOpt(sel))
                navEl.appendChild(sel)
                mcont.appendChild(navEl)
            } else {
                scope.plot.apply(scope, [group, nav])
            }

        }
        parseLevel(this.group, 0, {})
        this.container.appendChild(mcont)
    }
    plot(group, nav) {
        console.log(nav)
        const cScale = d3.scaleOrdinal(d3.schemeCategory10).domain(group.map(item => item[0] + item[1]).reduce((a, b) => a.indexOf(b) !== -1 ? a : [...a, b], []));
        const colorScale = function (d) {
            if ('datum' in d) {
                return cScale(d.label + d.group)
            } else {
                return cScale(d[0] + d[1])
            }
        }
        const plotTypes = {"line": AntGroupsLine, "cartesian": AntGroupsCartesian, "labels": AntGroupsLabels, "pivot": AntGroupsPivot}
        if ('plot' in this.source.dataset && 'plot_x' in this.source.dataset && 'plot_y' in this.source.dataset) {
            var plots = this.source.dataset['plot'].split(',')
            for (var p in plots) {
                let h = new plotTypes[plots[p]](this.source, this.plotContainer[plots[p]], this.svg[plots[p]], group, colorScale, this.config, this.eventHandler)
            }
        }
    }
}
class AntParsers {
    data = {};
    controlledElement = null;
    controlledDataset = null;
    groups = {};
    config = null;
    constructor (config) {
        this.config = config
    }
    eventHandler (event) {
        this.parseElement(event.target, event)
    }
    debug(_, message) {
        console.log(message)
    }
    async #download(element, url, handler) {
        if ('pre_download' in element.dataset) {
            this.parseElements(document.querySelectorAll(element.dataset['pre_download']))
        }
        const data = await d3[handler](url);
        if ('dataset' in element.dataset) {
            this.data[element.dataset['dataset']] = data
        }
        if ('post_download' in element.dataset) {
            this.parseElements(document.querySelectorAll(element.dataset['post_download']))
        }
        return data
    }
    async download_csv(element, url) {
        const data = await this.#download(element, url, 'csv')
    }
    async download_json(element, url) {
        const data = await this.#download(element, url, 'json')
    }
    control_element(source, selector) {
        this.controlledElement = document.querySelectorAll(selector)
    }
    release_element(source) {
        this.controlledElement = null
    }
    set_class(source, cls) {
        let elm = this.controlledElement != null ? this.controlledElement : source
        elm.classList.add(cls)
    }
    toggle_visibility() {
        if (this.controlledElement != null) {
            this.controlledElement.forEach(x => x.style.display = x.style.display === "none" ? "block" : "none")
        }
    }
    toggle_class(source, cls) {
        let elms = this.controlledElement != null ? this.controlledElement : [source]
        for (let i = 0; i < elms.length; i++) {
            elms[i].classList.toggle(cls)
        }
    }
    control_dataset(source, dataset) {
        this.controlledDataset = dataset
    }
    groupby(source, groups) {
        if (this.controlledDataset != null) {
            let grps = groups.split(',')
            let args = [this.data[this.controlledDataset]]
            for (let grp in grps) {
                let fn = function(grp) {
                    return function(d) { return d[grp] }
                }
                args.push(fn(grps[grp]))
            }
            let r = d3.group.apply(this, args)
            let g = new AntGroups(source, r, config)
            if ('group_id' in source.dataset) {
                this.groups[source.dataset['group_id']] = g
            }
        }

    }
    parseElements(collection) {
        for (let i = 0; i < collection.length; i++) {
            this.parseElement(collection[i])
        }
    }
    parseElement(element, eventData) {
        this.controlledElement = null
        this.controlledDataset = null
        for (let dt in element.dataset) {
            if (dt in this) {
                this[dt](element, element.dataset[dt], eventData)
            }
        }
    }
    addEventListener(element, event){
        element.addEventListener(event, this.eventHandler.bind(this))
    }
}
class Ant {
    config = null
    constructor(config) {
        const parser = new AntParsers(config)
        this.config = config
        this.parser = parser
    }
    start(event) {
        this.onLoad(event)
    }
    onLoad(event) {
        let ret = document.querySelectorAll('[data-on]');
        for (let i = 0; i < ret.length; i++) {
            if (ret[i].dataset['on']) {
                this.parser.addEventListener(ret[i], ret[i].dataset['on'])
            }
        }
    }
}
