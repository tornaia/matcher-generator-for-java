'use strict';

/**
 * @ngdoc function
 * @name matcherGeneratorForJavaApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the matcherGeneratorForJavaApp
 */
angular.module('matcherGeneratorForJavaApp')
  .controller('MainCtrl', ['$scope', function ($scope) {

	var TAB = '\t';

	$scope.sourceText = 'package whatever.pack.age;\n\npublic class HelloWorld {\n\n\tpublic char publicPrimitive;\n\n\tpublic Integer publicBoxedPrimitive;\n\n\tpublic CustomType publicCustomType;\n\n\tpublic List<String> publicList;\n\n\tpublic long getWhateverLong() {\n\t\treturn 1L;\n\t}\n\n\tpublic boolean isWhateverBoolean() {\n\t\treturn true;\n\t}\n}';

	$scope.convert = function() {
		try {
			$scope.convertFunction();
		} catch (error) {
			$scope.resultText = 'Error! Please check the source! Maybe its a bug? Then please notify me! :)';
		}
	};

    $scope.convertFunction = function() {
		function upperCaseFirstChar(input) {
			return input.substring(0,1).toUpperCase()+input.substring(1);
		}

		function lowerCaseFirstChar(input) {
			return input.substring(0,1).toLowerCase()+input.substring(1);
		}

		function convertPrimitiveTypeToBoxedType(type) {
			if (type === 'int') {
				return 'Integer';
			} else if (type === 'char') {
				return 'Character';
			}
			return upperCaseFirstChar(type);
		}

		function isBoxedPrimitive(type) {
			return ['Boolean', 'Byte', 'Character', 'Float', 'Integer', 'Long', 'Short', 'Double'].indexOf(type) !== -1;
		}

		var classAsJson = JavaParser.parse($scope.sourceText);

		/*
			package js.java.parser;
		*/
		var sectionPackage = (function () {
									var packages = [];
									function calculate(obj) {
										for (var property in obj) {
											if (obj.hasOwnProperty(property)) {
												if (property === 'identifier') {
													packages.push(obj[property]);
												}
												if (typeof obj[property] === "object") {
													calculate(obj[property]);
												}
											}
										}
									}
									calculate(classAsJson['package']);
									return packages.length === 0 ? '' : 'package ' + packages.join('.') + ';';
								})();

		/*
			import org.hamcrest.Matcher;
			import org.hamcrest.core.IsAnything;

			import hu.ipsystems.matcher.KipTypeSafeDiagnosingMatcher;
		*/
		var sectionImports = 'import static org.hamcrest.Matchers.contains;\nimport static org.hamcrest.Matchers.is;\n\nimport org.hamcrest.Description;\nimport org.hamcrest.Matcher;\nimport org.hamcrest.TypeSafeDiagnosingMatcher;\nimport org.hamcrest.core.IsAnything;';

		/*
			public class HelloWorldMatcher extends TypeSafeDiagnosingMatcher<HelloWorld> { {
		*/
		var sectionClassSignatureOpen = (function () {
									var baseClassName = classAsJson.types[0].name.identifier;
									return 'public class ' + baseClassName + 'Matcher extends TypeSafeDiagnosingMatcher<' + baseClassName + '> {';
								})();


		/*
			private Matcher<Long> value = new IsAnything<>();
		*/
		var sectionFields = (function () {
									var fields = '';
									var bodyDeclarations = classAsJson.types[0].bodyDeclarations;
									for (var bodyDeclarationIdx in bodyDeclarations) {
										var bodyDeclaration = bodyDeclarations[bodyDeclarationIdx];
										var node = bodyDeclaration.node;

										var isMethodDeclaration = node === 'MethodDeclaration';
										var isFieldDeclaration = node === 'FieldDeclaration';

										var matcherClass;
										var variableName;
										if (isMethodDeclaration) {
											var methodIdentifier = bodyDeclaration.name.identifier;

											var isGetterMethod = methodIdentifier.indexOf('get') === 0 || methodIdentifier.indexOf('is') === 0;
											if (!isGetterMethod) {
												continue;
											}

											var getterPrefixLength = methodIdentifier.indexOf('get') === 0 ? 3 : 2;
											variableName = lowerCaseFirstChar(methodIdentifier.substr(getterPrefixLength));

											var isPrimitiveType = bodyDeclaration.returnType2.primitiveTypeCode !== undefined;
											var isParameterized = bodyDeclaration.returnType2.node === 'ParameterizedType';
											if (isPrimitiveType) {
												matcherClass = convertPrimitiveTypeToBoxedType(bodyDeclaration.returnType2.primitiveTypeCode);
											} else if (isParameterized) {
												matcherClass = bodyDeclaration.returnType2.type.name.identifier + '<' + bodyDeclaration.returnType2.typeArguments[0].name.identifier + '>';
											} else {
												matcherClass = bodyDeclaration.returnType2.name.identifier;
											}
										} else if (isFieldDeclaration) {
											var isPublicField = bodyDeclaration.modifiers[0].keyword === 'public';
											if (!isPublicField) {
												continue;
											}
											variableName = bodyDeclaration.fragments[0].name.identifier;
											var isPrimitiveType = bodyDeclaration.type.node === 'PrimitiveType';
											var isParameterized = bodyDeclaration.type.node === 'ParameterizedType';
											if (isPrimitiveType) {
												matcherClass = convertPrimitiveTypeToBoxedType(bodyDeclaration.type.primitiveTypeCode);
											} else if (isParameterized) {
												var isList = bodyDeclaration.type.type.name.identifier === 'List';
												if (isList) {
													matcherClass = 'Iterable<? extends ' + bodyDeclaration.type.typeArguments[0].name.identifier + '>';
												} else {
													matcherClass = bodyDeclaration.type.type.name.identifier + '<' + bodyDeclaration.type.typeArguments[0].name.identifier + '>';
												}
											} else {
												matcherClass = bodyDeclaration.type.name.identifier;
											}
										}

										fields += TAB + 'private Matcher<' + matcherClass + '> ' + variableName + ' = new IsAnything<>();\n\n';
									}

									return fields;
								})();

		/*
			public BackhaulLineMatcher lineNumber(Integer lineNumber) {
				this.lineNumber = is(lineNumber);
			return this;
		*/
		var sectionBuilderMethods = (function () {
									var fields = '';
									var bodyDeclarations = classAsJson.types[0].bodyDeclarations;
									for (var bodyDeclarationIdx in bodyDeclarations) {
										var bodyDeclaration = bodyDeclarations[bodyDeclarationIdx];
										var node = bodyDeclaration.node;

										var isMethodDeclaration = node === 'MethodDeclaration';
										var isFieldDeclaration = node === 'FieldDeclaration';

										var builderReturnType = classAsJson.types[0].name.identifier;
										var variableName;
										var matcherClass;
										var matcherMethod = 'is';
										var isPrimitiveType = isFieldDeclaration && bodyDeclaration.type.node === 'PrimitiveType' || isMethodDeclaration && !bodyDeclaration.constructor && bodyDeclaration.returnType2.node === 'PrimitiveType';
										var isBoxedPrimitiveType = !isPrimitiveType && (isFieldDeclaration && bodyDeclaration.type.node !== 'PrimitiveType' && bodyDeclaration.type.node !== 'ParameterizedType' && isBoxedPrimitive(bodyDeclaration.type.name.identifier) || isMethodDeclaration && !bodyDeclaration.constructor && bodyDeclaration.returnType2.node !== 'PrimitiveType' && bodyDeclaration.returnType2.node !== 'ParameterizedType' && isBoxedPrimitive(bodyDeclaration.returnType2.name.identifier));

										if (isMethodDeclaration) {
											var methodIdentifier = bodyDeclaration.name.identifier;

											var isGetterMethod = methodIdentifier.indexOf('get') === 0 || methodIdentifier.indexOf('is') === 0;
											if (!isGetterMethod) {
												continue;
											}

											var getterPrefixLength = methodIdentifier.indexOf('get') === 0 ? 3 : 2;
											variableName = lowerCaseFirstChar(methodIdentifier.substr(getterPrefixLength));

											var isPrimitiveType = bodyDeclaration.returnType2.primitiveTypeCode !== undefined;
											var isParametrized = bodyDeclaration.returnType2.node === 'ParameterizedType';
											if (isPrimitiveType) {
												matcherClass = convertPrimitiveTypeToBoxedType(bodyDeclaration.returnType2.primitiveTypeCode);
											} else if (isParametrized) {
												matcherClass = bodyDeclaration.returnType2.type.name.identifier + '<' + bodyDeclaration.returnType2.typeArguments[0].name.identifier + '>';
											} else if (isBoxedPrimitiveType) {
												matcherClass = bodyDeclaration.returnType2.name.identifier;
											} else {
												matcherClass = 'Matcher<' + bodyDeclaration.returnType2.name.identifier + '>';
											}
										} else if (isFieldDeclaration) {
											var isPublicField = bodyDeclaration.modifiers[0].keyword === 'public';
											if (!isPublicField) {
												continue;
											}

											variableName = bodyDeclaration.fragments[0].name.identifier;
											var isPrimitiveType = bodyDeclaration.type.node === 'PrimitiveType';
											var isParameterized = bodyDeclaration.type.node === 'ParameterizedType';
											if (isPrimitiveType) {
												matcherClass = convertPrimitiveTypeToBoxedType(bodyDeclaration.type.primitiveTypeCode);
											} else if (isParameterized) {
												var isList = bodyDeclaration.type.type.name.identifier === 'List';
												if (isList) {
													matcherClass = 'Matcher<' + bodyDeclaration.type.typeArguments[0].name.identifier + '>... ';
													matcherMethod = 'contains';
												} else {
													matcherClass = bodyDeclaration.type.type.name.identifier + '<' + bodyDeclaration.type.typeArguments[0].name.identifier + '>';
												}
											} else if (isBoxedPrimitiveType) {
												matcherClass = bodyDeclaration.type.name.identifier;
											} else {
												matcherClass = 'Matcher<' + bodyDeclaration.type.name.identifier + '>';
											}
										} else {
											continue;
										}

										var howToAssignToThisVariable = isPrimitiveType || isBoxedPrimitiveType ? matcherMethod + '(' + variableName + ')' : variableName;

										fields += TAB + 'public ' + builderReturnType + 'Matcher ' + variableName + '(' + matcherClass + ' ' + variableName + ') {\n' + TAB + TAB + 'this.' + variableName + ' = ' + howToAssignToThisVariable + ';\n' + TAB + TAB + 'return this;\n' + TAB + '}\n\n';
									}

									return fields;
								})();

		/*
			@Override
			protected boolean matchesSafely(BackhaulLine item, Description mismatchDescription) {
				return matches(lineNumber, item.getLineNumber(), "lineNumber erteke: ", mismatchDescription) &&
						matches(networkPoint, item.getNetworkPoint(), "networkPointErteke: ", mismatchDescription) &&
						matches(shipperPair, item.getShipperPair(), "shipperPair erteke: ", mismatchDescription) &&
						matches(hourlyQuantity, item.getHourlyQuantity(), "hourlyQUantity erteke: ", mismatchDescription);
			}
		*/
		var sectionMatchesSafely = (function () {
									var baseClassName = classAsJson.types[0].name.identifier;
									var matchesSafelyPrefix = TAB + '@Override\n' + TAB + 'protected boolean matchesSafely(' + baseClassName + ' item, Description mismatchDescription) {\n' + TAB + TAB + 'return ';

									var bodyDeclarations = classAsJson.types[0].bodyDeclarations;
									var matchesSafelyBody = '';
									for (var bodyDeclarationIdx in bodyDeclarations) {
										var bodyDeclaration = bodyDeclarations[bodyDeclarationIdx];
										var node = bodyDeclaration.node;

										var isMethodDeclaration = node === 'MethodDeclaration';
										var isFieldDeclaration = node === 'FieldDeclaration';

										var variableName;
										var methodIdentifier;

										if (isMethodDeclaration) {
											methodIdentifier = bodyDeclaration.name.identifier;

											var isGetterMethod = methodIdentifier.indexOf('get') === 0 || methodIdentifier.indexOf('is') === 0;
											if (!isGetterMethod) {
												continue;
											}

											var getterPrefixLength = methodIdentifier.indexOf('get') === 0 ? 3 : 2;
											variableName = lowerCaseFirstChar(methodIdentifier.substr(getterPrefixLength));

											methodIdentifier = bodyDeclaration.name.identifier + '()';
										} else if (isFieldDeclaration) {
											var isPublicField = bodyDeclaration.modifiers[0].keyword === 'public';
											if (!isPublicField) {
												continue;
											}

											methodIdentifier = variableName = bodyDeclaration.fragments[0].name.identifier;
										} else {
											continue;
										}


										if (matchesSafelyBody.length !== 0) {
											matchesSafelyBody += ' &&\n' + TAB + TAB;
										}
										matchesSafelyBody += 'matches(' + variableName + ', item.' + methodIdentifier + ', "' + variableName + ' erteke: ", mismatchDescription)';
									}

									var matchesSafelyPostFix = ';\n' + TAB + '}';
									return matchesSafelyPrefix + matchesSafelyBody + matchesSafelyPostFix;
								})();

		/*
			@Override
			public void describeTo(Description description) {
				description.appendText(BackhaulLine.class.getSimpleName())
					.appendText(", amiben lineNumber: ").appendDescriptionOf(lineNumber)
					.appendText(", networkPoint: ").appendDescriptionOf(networkPoint)
					.appendText(", shipperPair: ").appendDescriptionOf(shipperPair)
					.appendText(", hourlyQuantity: ").appendDescriptionOf(hourlyQuantity);
			}
		*/
		var sectionDescribeTo = (function () {
									var baseClassName = classAsJson.types[0].name.identifier;
									var describeToPrefix = TAB + '@Override\n' + TAB + 'public void describeTo(Description description) {\n' + TAB + TAB + 'description.appendText(' + baseClassName + '.class.getSimpleName())\n';

									var bodyDeclarations = classAsJson.types[0].bodyDeclarations;
									var describeToBody = '';
									for (var bodyDeclarationIdx in bodyDeclarations) {
										var bodyDeclaration = bodyDeclarations[bodyDeclarationIdx];
										var node = bodyDeclaration.node;

										var isMethodDeclaration = node === 'MethodDeclaration';
										var isFieldDeclaration = node === 'FieldDeclaration';

										var variableName;

										if (isMethodDeclaration) {
											var methodIdentifier = bodyDeclaration.name.identifier;

											var isGetterMethod = methodIdentifier.indexOf('get') === 0 || methodIdentifier.indexOf('is') === 0;
											if (!isGetterMethod) {
												continue;
											}

											var getterPrefixLength = methodIdentifier.indexOf('get') === 0 ? 3 : 2;
											variableName = lowerCaseFirstChar(methodIdentifier.substr(getterPrefixLength));

										} else if (isFieldDeclaration) {
											var isPublicField = bodyDeclaration.modifiers[0].keyword === 'public';
											if (!isPublicField) {
												continue;
											}

											variableName = bodyDeclaration.fragments[0].name.identifier;
										} else {
											continue;
										}


										if (describeToBody !== '') {
											describeToBody += '\n';
										}
										describeToBody += TAB + TAB + '.appendText(", ' + variableName + ': ").appendDescriptionOf(' + variableName + ')';
									}

									var describeToPostFix = ';\n' + TAB + '}';
									return describeToPrefix + describeToBody + describeToPostFix;
								})();

      var sectionMatchesMethod = (function () {
        return '\n' + TAB + 'protected <X> boolean matches(Matcher<? extends X> matcher, X value, String attribute, Description mismatchDescription) {\n' + TAB + TAB + 'if (!matcher.matches(value)) {\n' + TAB + TAB + TAB + 'mismatchDescription.appendText(" " + attribute + " ");\n' + TAB + TAB + TAB + 'matcher.describeMismatch(value, mismatchDescription);\n' + TAB + TAB + TAB + 'return false;\n' + TAB + TAB + '} else {\n' + TAB + TAB + TAB + 'return true;\n' + TAB + TAB + '}\n' + TAB + '}';
      })();

		var sectionClassSignatureClose = (function () {
									return '}';
								})();

		$scope.resultText = sectionPackage + '\n\n' + sectionImports + '\n\n' + sectionClassSignatureOpen + '\n\n' + sectionFields + sectionBuilderMethods + sectionMatchesSafely + '\n\n' + sectionDescribeTo +  '\n' + sectionMatchesMethod + '\n' + sectionClassSignatureClose;
	};
  }]);
