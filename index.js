'use strict';

var _ = require('lodash');
var mongoose = require('mongoose');
var CounterName = Counter;
var Counter = null;


exports.initialize = function(connection) {
	try {
		Counter = connection.model(CounterName);
	} catch (ex) {
		if (ex.name === 'MissingSchemaError') {
			// 创建一个Counter进行所有collection的seq记录
			counterSchema = new mongoose.Schema({
				model: {
					type: String,
					require: true,
					unique: true
				},
				field: {
					type: String,
					require: true
				},
				seq: {
					type: Number,
					default: 0
				}
			});

			//添加必要的索引在自动增长查询时尽量快速
			counterSchema.index({
				field: 1,
				model: 1
			});

			Counter = connection.model(CounterName, counterSchema);
		} else {
			throw ex;
		}
	}
};

var getNextSeq = function(model, field, callback) {
	Counter.findOneAndUpdate({
			model: name,
			field: field
		}, {
			$inc: {
				seq: 1
			}
		}, {
			new: true,
			upsert: true
		},
		function(err, ret) {
			callback(err, ret.seq);
		});
};

exports.plugin = function(schema, setting) {
	var default_setting = {
		model: null,
		field: '_id',
		startAt: 1
	};

	//获取关联设置
	_.assign(default_setting, setting);

	//添加自动增长列
	var auto_field = {};

	auto_field[default_setting.field] = {
		type: Number,
		unique: true
	};
	schema.add(auto_field);

	schema.pre('save', function(next) {
		var doc = this;

		Counter.findOne({
			model: default_setting.model,
			field: default_setting.field
		}, function(err, counter) {
			if (err) {
				return next(err);
			};

			var new_counter = new Counter({
				model: default_setting.model,
				field: default_setting.field
			});

			new_counter.save(function(err) {
				if (err) {
					return next(err);
				}
				getNextSeq(default_setting.model, default_setting.field, function(err, seq) {
					if (err) {
						return next(err);
					}
					doc[default_setting.field] = seq;
					next();
				});
			});
		});
	});

};