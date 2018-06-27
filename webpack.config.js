var fs = require("fs");
var webpack = require("webpack");
var Visualizer = require('webpack-visualizer-plugin');

var entryPoints = {};
fs.readdirSync("./entry")
    .filter(x => x.endsWith(".ts"))
    .forEach(x => entryPoints[x.slice(0, -3)] = "./entry/" + x);

console.log(entryPoints);

module.exports = env => {
    return [getConfig(env)];
}

function getConfig (env) {
    let node = env && !!env.node || false;

    let obj = {
        entry: entryPoints,
        output: {
            // Eh... our html files are in the entry folder, so we nest everything further in the entry folder.
            filename: "./dist/[name].js",
        },

        // Enable sourcemaps for debugging webpack's output.
        devtool: "source-map",

        resolve: {
            // Add '.ts' and '.tsx' as resolvable extensions.
            extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js"]
        },

        module: {
            rules: [
                // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
                { test: /\.tsx?$/, loader: "ts-loader" },
                { test: /\.less$/, loader: "style-loader!css-loader!less-loader" },
                { enforce: 'pre', test: /\.js$/, loader: "source-map-loader" },
            ]
        },

        plugins: [
            new webpack.DefinePlugin({
                NODE_CONSTANT: node,
                NODE: node
            }),
            new Visualizer(),
        ],

        resolveLoader: {
            modules: ['node_modules', './loaders']
        },
    };

    if (node) {
        obj["target"] = "node";
    } else {
    }

    return obj;
};