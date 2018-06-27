var fs = require("fs");
var webpack = require("webpack");
var Visualizer = require('webpack-visualizer-plugin');

module.exports = env => {
    return [getConfig(env)];
}

function getConfig (env) {
    let node = env && !!env.node || false;

    let obj = {
        mode: "production",
        entry: entryPoints = {
            index: "./index.ts"
        },
        output: {
            // Eh... our html files are in the entry folder, so we nest everything further in the entry folder.
            filename: "./[name].js",
            libraryTarget: "commonjs2"
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
            modules: ['node_modules']
        },
    };

    if (node) {
        obj["target"] = "node";
    }

    return obj;
};