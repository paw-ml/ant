const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
});
const config = {
    'callbacks': {
        'tooltip': function(label, group, sequence, metric_value) {
            const json = JSON.parse(label)
            var labels = []
            for (var l in json) {
                labels.push([l, json[l]])
            }
            labels.push(['group', group])
            labels.push(['sequence', sequence])
            labels.push(['value', formatter.format(metric_value)])

            return labels
        },
        'columnName': function() {
            console.log('columnName', arguments)
        },
        'labelsX': function () {
            console.log('labelsX', arguments)
        }
    }
}
const ant = new Ant(config)
Object.freeze(ant)
window.addEventListener("load", (event) => {
    ant.start(event)
});
