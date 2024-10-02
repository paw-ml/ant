//import * as d3 from "./d3.v7.min.js"
import {Tabulator} from 'https://unpkg.com/tabulator-tables@6.2.5/dist/js/tabulator_esm.min.mjs';
import * as d3 from "https://cdn.skypack.dev/d3@7";
d3.selection.prototype.attrs = function(map) {
    const elm = this;
    function cb(i, d) {
        if (typeof map == 'function') {
            map = {}
        }
        for (const name in map) elm.attr(name, map[name])
    }
    this.each(cb)
    return this
  }
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
        let cb = this.source.dataset['plot_xy_callback']
        let xCol = this.source.dataset['plot_x'].split(',').slice(-1)
        let yCol = this.source.dataset['plot_y']
        let me = this
        function rollup (sequences) { 
            let x = [], y = [], xy = []
            for (let i in sequences) {
                if (cb !== undefined) {
                    const cfn = me.config.callbacks[cb]
                    xy[i] = {xy: cfn.apply(me, [sequences[i]]), element: sequences[i]}
                } else {
                    xy[i] = {xy: ([sequences[i][xCol], sequences[i][yCol]]), element: sequences[i]}
                }
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
    getExtent(groups, xInt=true) {
        let allX = [], allY = []
        for (let g in groups) {
            let grp = groups[g], col = grp[grp.length - 1]
            function cb (seq, idx, intg) {
                var ret = []
                for (var i in seq) {
                    ret.push(d3.extent(seq[i].xy, d => intg ? parseInt(d[idx]) : d[idx] ).flat())
                }
                return ret.flat()
            }
            var extX = d3.extent(cb(col, 0, xInt))
            var extY = d3.extent(cb(col, 1, false))
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
                    const elements = [[data[g][0], data[g][1], data[g][2][i][0], data[g][2][i][1]]]
                    const labels = cb.apply(this, [elements])[0]
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
        this.container.classList.add("level")
        this.config = config
        this.colorScale = colorScale
    }
    handleHiglight(data) {
        this.container.replaceChildren()

        function elm(x, y) {
            let item = document.createElement('DIV')
            item.classList.add(...['level-item', 'has-text-centered'])
            let box = document.createElement('DIV')
            item.appendChild(box)

            let head = document.createElement('P')
            head.classList.add('heading')
            head.innerText = x
            box.appendChild(head)

            let title = document.createElement('P')
            title.classList.add('title')
            title.innerText = y
            box.appendChild(title)
            return item
        }
        var [element, idx, [x, y]] = data

        this.container.appendChild(elm("X", x))
        this.container.appendChild(elm("Value", y))

        for (var lbl in element.element) {
            if (typeof element.element[lbl] !== "object") {
                this.container.appendChild(elm(lbl, element.element[lbl]))
            }
        }
        console.log (idx, x, y)

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
        this.addEventListener('highlight', this.handleHighlight)
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
    handleHighlight(data) {
        this.svg.selectAll(".highlight").classed("highlight", false)
        let d = data[0][0]
        let ret = document.querySelectorAll(`[data-label="${d[0]}"][data-group="${d[1]}"][data-x="${d[2]}"][data-y="${d[3]}"]`)
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
                        ret.push({label: data[1][0], group: data[1][1], datum: data[1][2][r], index: r, universe: data[1][2]})
                    }
                }
            }
            return ret
        }
        const me = this;
        function pointerEnter(e, d) {
            let dt = [[d.label, d.group, ...d.datum]]
            if (d.index > 0) {
                dt.push([d.label, d.group, ...d.universe[d.index-1]])
            }
            me.emitEvent.apply(me, ['highlight', [dt]])
            e.srcElement.classList.add("highlight")
        }
        
        const cScale = this.colorScale
        function circle(circle) {
            circle
                .attr("r", 5)
                .attr("cx", coordinateX)
                .attr("cy", coordinateY)
                .attr("fill", cScale)
                .attr("fill-opacity", "0.3")
                .attr("stroke", cScale)
                .attr("data-group", (d) => d.group)
                .attr("data-label", (d) => d.label)
                .attr("data-x", (d) => d.datum[0])
                .attr("data-y", (d) => d.datum[1])
                .on("pointerenter pointermoved", pointerEnter)
            return circle
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
                        enter => circle(enter.append('circle')),
                        update => circle(update.transition().duration(500))
                    ),
                u => u.selectAll("circle")
                    .data(getData(u))
                    .join(
                        enter => circle(enter.append('circle')),
                        update => circle(update)
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
        
        let groups = this.groupData()
        this.scales (groups)

        this.rule = svg.append("g")
            .append("line")
            .attr("y1", this.height - this.margin)
            .attr("y2", this.margin)
            .attr("stroke", "black");


        this.plot(groups)
    }
    scales (groups) {
        let xScale = "plot_x_scale" in this.source.dataset ? this.source.dataset["plot_x_scale"] : "scalePoint"
        let notInteger = ["scaleTime"]
        let all = this.getExtent(groups, xScale in notInteger)
        let domainCb = {
            "scaleTime": (d) => { return all[0] }
        }
        let getDomain = "plot_x_scale" in this.source.dataset && this.source.dataset["plot_x_scale"] in domainCb ? domainCb[this.source.dataset["plot_x_scale"]] : this.getDomain 

        this.scaleX = d3[xScale]()
            .domain(getDomain(groups))
            .range([this.margin, this.width - this.margin]);

        this.scaleY = d3.scaleLinear()
            .domain(d3.extent(all[1]))
            .range([this.height - this.margin, this.margin])
            .nice();
    }
    handleHiglight(series) {
        //BUG needs to be elements not elements[0]
        var me = this
        function circle(circle) {
            circle
                .attr('class', 'highlight')
                .attr('cx', (d) => me.scaleX(d[2][0]))
                .attr('cy', (d) => me.scaleY(d[2][1]))
                //.attr('fill', me.colorScale)
                .attr('r', '2')

            return circle
        }
        this.svg.selectAll('circle.highlight')
            .data([series])
            .join(
                enter => circle(enter.append('circle')),
                update => circle(update)
            )
        this.rule
            .attr("transform", `translate(${this.scaleX(series[2][0]) + 0.5},0)`)
    }
    line () {
        var me = this
        return function(d) {
            var xy = d.xy
            var ln = d3
                .line()
                .x(d => me.scaleX(d[0]))
                .y(d => me.scaleY(d[1]))
                .curve(d3.curveCatmullRom.alpha(0.5))
    
            return ln(xy)
        }
    }
    plot(groups) {
        this.svg.selectAll("circle.highlight").remove()
        const xAxis = d3.axisBottom(this.scaleX);
        const yAxis = d3.axisLeft(this.scaleY);
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
        var me = this;
        
        function pointerLeft() {
            //tooltip.style("display", "none");
        }
        function pointerMoved(ev, series) {
            var data = series.xy
            const points = data.map(([x, y]) => [me.scaleX(x), me.scaleY(y)])

            const [xm, ym] = d3.pointer(ev);
            const i = d3.leastIndex(points, ([x, y]) => Math.hypot(x - xm, y - ym));
            me.emitEvent.apply(me, ['highlight', [series, i, series.xy[i]]])
        }
        var series = groups.map((d) => d[d.length -1]).flat()
        this.svg
        .selectAll("path.dataset")
            .data(series)
            .join(
                enter => enter.append('path')
                    .attr("class", "dataset")
                    .attr("d", this.line())
                    .attr("fill", "none")
                    .attr("stroke", this.colorScale),
                update => update.transition()
                    .duration(500)
                    .attr("d", this.line())
                    .attr("stroke", this.colorScale)
            )
        .on("pointerenter pointermove", pointerMoved)
        this.svg
        .on("pointerleave", pointerLeft)
    }
    pointerMoved(event, data) {
        
    }
}
class AntGroupsLineCumsum extends AntGroupsLine {
    group = null
    container = null
    source =null
    width = 1000
    height = 500
    margin = 60
    config = null;
    constructor(source, plotContainer, svg, group, colorScale, config, eventsManager) {
    
        super(source, plotContainer, svg, group, colorScale, config, eventsManager)
        this.container = plotContainer
        this.config = config
        this.group = group
        this.source = source
        this.svg = svg
        this.colorScale = colorScale
       
        

    }
    /*
    getExtent(groups, xInt=true) {
        let allX = [], allY = []
        for (let g in groups) {
            let grp = groups[g], col = grp[grp.length - 1]
            function cb (seq, idx, intg) {
                var ret = []
                for (var i in seq) {
                    ret.push(d3.extent(seq[i].xy, d => intg ? parseInt(d[idx]) : d[idx] ).flat())
                }
                return ret.flat()
            }
            function cs (seq) {
                var ret = []
                for (var i in seq) {
                    ret.push(d3.extent(seq[i].xy, d => d3.cumsum(d, a => a[1])))
                }

                return ret.flat()
            }
            var extX = d3.extent(cb(col, 0, xInt))
            var extY = d3.extent(cs(col))
            allX.push(extX[0])
            allX.push(extX[1])
            allY.push(extY[0])
            allY.push(extY[1])
        }
        return [allX, allY]
    }*/
    scales (groups) {
        super.scales(groups)

        let max = 0
        for (let g in groups) {
            let grp = groups[g], col = grp[grp.length - 1]
            console.log(col)
            for (let c in col) {
                let m = d3.cumsum(col[c].xy, a => a[1])[col[c].xy.length - 1]
                max = m > max ? m : max
            }
        }

        this.scaleY = d3.scaleLinear()
            .domain([0, max])
            .range([this.height - this.margin, this.margin])
            .nice();

        console.log(this.scaleY.domain())
    }
    line () {
        var me = this
        return function(d) {
            var xy = d.xy
            function getY(d, i, c) {
                if (i > 0) {
                    let y = d3.cumsum(c.slice(0, i), a => a[1])
                    return me.scaleY(y[i - 1])
                }
                return me.scaleY(0)
            }
            var ln = d3
                .line()
                .x(d=> me.scaleX(d[0]))
                .y(getY)
                .curve(d3.curveCatmullRom.alpha(0.5))
            
            console.log(me.scaleY.domain())
    
            return ln(xy)
        }
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
        const cScale = d3.scaleOrdinal(d3.schemeCategory10).domain(group.map(item => item[0] + item[1]).reduce((a, b) => a.indexOf(b) !== -1 ? a : [...a, b], []));
        const colorScale = function (d) {
            console.log(d)
            if ('datum' in d) {
                return cScale(d.label + d.group)
            } else {
                //TODO: 
                return cScale(d.element)
            }
        }
        const plotTypes = {
            "line": AntGroupsLine, "cartesian": AntGroupsCartesian, "labels": AntGroupsLabels, "pivot": AntGroupsPivot,
            "cumsum": AntGroupsLineCumsum
        }
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
            let g = new AntGroups(source, r, this.config)
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
export class Ant {
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
                if (ret[i].dataset['on'] == 'load') {
                    this.parser.parseElement(ret[i])
                }
                this.parser.addEventListener(ret[i], ret[i].dataset['on'])
            }
        }
    }
}
